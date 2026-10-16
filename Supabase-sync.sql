-- Adds atomic, version-checked saves for the tm-api Edge Function.
begin;
create or replace function public.tm_save_record(
 p_actor uuid,p_kind text,p_id text,p_payload jsonb,p_version bigint,p_delete boolean default false
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.tm_profiles; old_record public.tm_records; saved public.tm_records; deleted_users uuid[] := '{}';
begin
 select * into actor from public.tm_profiles where id=p_actor and status='Active';
 if not found then raise exception 'Account inactive'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||p_id,0));
 select * into old_record from public.tm_records where kind=p_kind and id=p_id for update;
 if coalesce(old_record.version,0)<>p_version then raise exception 'CONFLICT: Reload the latest record before saving'; end if;
 if actor.role not in ('Administrator','Admin','Coordinator') then
  if p_delete or p_kind not in ('overtime','leave_request','technician') then raise exception 'Access denied'; end if;
  if p_kind='technician' then
   if p_id<>actor.technician_id or old_record.id is null then raise exception 'Access denied'; end if;
   if (p_payload - array['name','mobileNumber','role','passes','cprNumber','cprExpiryDate','visaNumber','visaExpiryDate']) is distinct from
      (old_record.payload - array['name','mobileNumber','role','passes','cprNumber','cprExpiryDate','visaNumber','visaExpiryDate']) then raise exception 'Only own personal details and documents can be changed'; end if;
   if length(trim(coalesce(p_payload->>'name','')))=0 or length(p_payload->>'name')>100 or
      (coalesce(p_payload->>'mobileNumber','')<>'' and p_payload->>'mobileNumber' !~ '^\d{8}$') or
      length(coalesce(p_payload->>'role',''))>100 then raise exception 'Invalid personal details'; end if;
  else
   if old_record.id is not null and old_record.owner_id is distinct from actor.id then raise exception 'Access denied'; end if;
   if (p_payload->>'ownerId') is distinct from actor.id::text or coalesce(p_payload->>'ownerTechnicianId',p_payload->>'technicianId','')<>actor.technician_id then raise exception 'Ownership mismatch'; end if;
   if p_kind='leave_request' and (old_record.id is not null or coalesce(p_payload->>'status','Pending')<>'Pending' or coalesce(p_payload->>'certificateReceived','false')<>'false' or coalesce(p_payload->>'remark','')<>'' or coalesce(p_payload->>'rejectionReason','')<>'') then raise exception 'Only managers can review existing requests'; end if;
  end if;
 end if;
 -- Validate review actions in the database, not only in the browser.
 if p_kind='leave_request' and not p_delete then
  if coalesce(p_payload->>'status','Pending') not in ('Pending','Confirmed','Rejected','Closed') then raise exception 'Invalid leave request status'; end if;
  if old_record.id is not null then
   if p_payload->>'ownerId' is distinct from old_record.payload->>'ownerId' or
      p_payload->>'technicianId' is distinct from old_record.payload->>'technicianId' then raise exception 'Leave request ownership cannot change'; end if;
   if p_payload->>'status' is distinct from coalesce(old_record.payload->>'status','Pending') and not (
     coalesce(old_record.payload->>'status','Pending')='Pending' and p_payload->>'status' in ('Confirmed','Rejected') or
     old_record.payload->>'status'='Confirmed' and p_payload->>'status'='Closed'
   ) then raise exception 'Invalid leave review transition'; end if;
  elsif coalesce(p_payload->>'status','Pending')<>'Pending' then raise exception 'New leave requests must be pending'; end if;
  if p_payload->>'status'='Rejected' and (length(trim(coalesce(p_payload->>'rejectionReason','')))=0 or length(p_payload->>'rejectionReason')>2000) then raise exception 'A rejection reason is required'; end if;
  if p_payload->>'status'='Confirmed' and p_payload->>'type'='Medical Leave' and coalesce(p_payload->>'certificateReceived','false')<>'true' then raise exception 'Medical certificate must be received before confirming'; end if;
 end if;
 if p_delete then
  if p_kind='technician' then
   -- Remove linked application accounts in the same transaction. Historical
   -- payloads retain ownerId/ownerName; only the live profile FK is detached.
   select coalesce(array_agg(id),'{}'::uuid[]) into deleted_users
   from public.tm_profiles where role='Technician'
    and ltrim(technician_id,'0')=ltrim(p_id,'0');
   update public.tm_records set owner_id=null where owner_id=any(deleted_users);
   delete from public.tm_profiles where id=any(deleted_users);
  end if;
  delete from public.tm_records where kind=p_kind and id=p_id;
  return jsonb_build_object('deleted',true,'kind',p_kind,'id',p_id,'deleted_user_ids',to_jsonb(deleted_users));
 end if;
 if jsonb_typeof(p_payload)<>'object' or p_payload ?| array['password','access_token','refresh_token'] then raise exception 'Invalid record'; end if;
 insert into public.tm_records(kind,id,owner_id,technician_id,payload)
 values(p_kind,p_id,
  -- A deleted owner's UUID remains in the payload for history, never as a dangling FK.
  case when p_kind in ('overtime','leave_request') then (select id from public.tm_profiles where id=nullif(p_payload->>'ownerId','')::uuid) else null end,
  case when p_kind='technician' then p_id else coalesce(p_payload->>'technicianId',p_payload->>'ownerTechnicianId') end,p_payload)
 on conflict(kind,id) do update set payload=excluded.payload,owner_id=excluded.owner_id,technician_id=excluded.technician_id
 returning * into saved;
 -- Create the calendar entry in the same transaction as confirmation.
 if p_kind='leave_request' and p_payload->>'status'='Confirmed' and coalesce(old_record.payload->>'status','Pending')='Pending' then
  insert into public.tm_records(kind,id,technician_id,payload)
  values('leave','confirmed-'||p_id,p_payload->>'technicianId',jsonb_build_object(
   'id','confirmed-'||p_id,'technicianId',p_payload->>'technicianId','technicianName',p_payload->>'technicianName',
   'type',case when p_payload->>'type'='Medical Leave' then 'Sick Leave' else 'Emergency Leave' end,
   'leaveType',case when p_payload->>'type'='Medical Leave' then 'Sick Leave' else 'Emergency Leave' end,
   'startDate',p_payload->>'startDate','endDate',p_payload->>'endDate','notes',coalesce(p_payload->>'remark',''),'requestId',p_id))
  on conflict(kind,id) do update set payload=excluded.payload,technician_id=excluded.technician_id;
 end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.tm_save_record(uuid,text,text,jsonb,bigint,boolean) from public,anon,authenticated;
grant execute on function public.tm_save_record(uuid,text,text,jsonb,bigint,boolean) to service_role;
-- All application data access goes through the authenticated tm-api service.
revoke all privileges on table public.tm_records,public.tm_profiles from public,anon,authenticated;
grant all privileges on table public.tm_records,public.tm_profiles to service_role;
revoke execute on function public.tm_role(),public.tm_technician_id() from public,anon,authenticated;
grant execute on function public.tm_role(),public.tm_technician_id() to service_role;
revoke execute on function public.tm_record_stamp() from public,anon,authenticated;
commit;



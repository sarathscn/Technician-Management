-- Adds atomic, version-checked saves for the tm-api Edge Function.
begin;
create or replace function public.tm_save_record(
 p_actor uuid,p_kind text,p_id text,p_payload jsonb,p_version bigint,p_delete boolean default false
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.tm_profiles; old_record public.tm_records; saved public.tm_records;
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
   if p_kind='leave_request' and (old_record.id is not null or coalesce(p_payload->>'status','Pending')<>'Pending') then raise exception 'Only managers can review existing requests'; end if;
  end if;
 end if;
 if p_delete then
  delete from public.tm_records where kind=p_kind and id=p_id;
  return jsonb_build_object('deleted',true,'kind',p_kind,'id',p_id);
 end if;
 if jsonb_typeof(p_payload)<>'object' or p_payload ?| array['password','access_token','refresh_token'] then raise exception 'Invalid record'; end if;
 insert into public.tm_records(kind,id,owner_id,technician_id,payload)
 values(p_kind,p_id,
  case when p_kind in ('overtime','leave_request') then nullif(p_payload->>'ownerId','')::uuid else null end,
  case when p_kind='technician' then p_id else coalesce(p_payload->>'technicianId',p_payload->>'ownerTechnicianId') end,p_payload)
 on conflict(kind,id) do update set payload=excluded.payload,owner_id=excluded.owner_id,technician_id=excluded.technician_id
 returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.tm_save_record(uuid,text,text,jsonb,bigint,boolean) from public,anon,authenticated;
grant execute on function public.tm_save_record(uuid,text,text,jsonb,bigint,boolean) to service_role;
revoke insert,update,delete on public.tm_records from authenticated;
revoke execute on function public.tm_role(),public.tm_technician_id() from anon;
revoke execute on function public.tm_record_stamp() from public,anon,authenticated;
commit;



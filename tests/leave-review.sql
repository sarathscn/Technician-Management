begin;
do $test$
declare
 manager_id uuid:=gen_random_uuid(); coordinator_id uuid:=gen_random_uuid(); technician_user uuid:=gen_random_uuid(); deleted_owner uuid:=gen_random_uuid();
 prefix text:='qa-leave-'||gen_random_uuid()::text;
 record jsonb; payload jsonb; version bigint;
begin
 insert into auth.users(id) values(manager_id),(coordinator_id),(technician_user);
 insert into public.tm_profiles(id,username,name,technician_id,role,status) values
 (manager_id,'qa-'||manager_id,'QA Admin','99890','Administrator','Active'),
 (coordinator_id,'qa-'||coordinator_id,'QA Coordinator','99891','Coordinator','Active'),
 (technician_user,'qa-'||technician_user,'QA Technician','99892','Technician','Active');
 payload:=jsonb_build_object('id',prefix,'ownerId',deleted_owner::text,'technicianId','99893','technicianName','Former technician','type','Medical Leave','startDate','2026-10-16','endDate','2026-10-16','status','Pending','certificateReceived',false,'reason','Test');
 -- History can be retained for a deleted owner and still reviewed.
 record:=public.tm_save_record(manager_id,'leave_request',prefix,payload,0,false);version:=(record->>'version')::bigint;
 if record->>'owner_id' is not null then raise exception 'Dangling owner FK retained'; end if;
 begin
  perform public.tm_save_record(coordinator_id,'leave_request',prefix,payload||'{"status":"Rejected","rejectionReason":""}',version,false);
  raise exception 'Empty rejection reason accepted';
 exception when others then if sqlerrm<>'A rejection reason is required' then raise; end if; end;
 record:=public.tm_save_record(coordinator_id,'leave_request',prefix,payload||'{"status":"Rejected","rejectionReason":"Dates are not available"}',version,false);
 if record->'payload'->>'status'<>'Rejected' then raise exception 'Rejection not persisted'; end if;
 if exists(select 1 from public.tm_records where kind='leave' and id='confirmed-'||prefix) then raise exception 'Rejected request created leave'; end if;
 payload:=jsonb_set(payload,'{id}',to_jsonb(prefix||'-confirm'));
 record:=public.tm_save_record(manager_id,'leave_request',prefix||'-confirm',payload,0,false);version:=(record->>'version')::bigint;
 begin
  perform public.tm_save_record(coordinator_id,'leave_request',prefix||'-confirm',payload||'{"status":"Confirmed"}',version,false);
  raise exception 'Medical leave confirmed without certificate';
 exception when others then if sqlerrm<>'Medical certificate must be received before confirming' then raise; end if; end;
 record:=public.tm_save_record(coordinator_id,'leave_request',prefix||'-confirm',payload||'{"status":"Confirmed","certificateReceived":true}',version,false);
 if not exists(select 1 from public.tm_records r where r.kind='leave' and r.id='confirmed-'||prefix||'-confirm' and r.payload->>'requestId'=prefix||'-confirm') then raise exception 'Calendar entry missing'; end if;
 begin
  perform public.tm_save_record(technician_user,'leave_request',prefix||'-confirm',record->'payload',(record->>'version')::bigint,false);
  raise exception 'Technician reviewed someone else request';
 exception when others then if sqlerrm<>'Access denied' then raise; end if; end;
end $test$;
rollback;

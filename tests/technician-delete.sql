-- Run inside a transaction and ROLLBACK. Creates only synthetic test accounts.
do $test$
declare
 manager_id uuid := gen_random_uuid();
 tech_user uuid := gen_random_uuid();
 second_user uuid := gen_random_uuid();
 coordinator_id uuid := gen_random_uuid();
 history_id text := 'qa-delete-history-'||gen_random_uuid()::text;
 result jsonb;
begin
 if exists(select 1 from public.tm_records where kind='technician' and id='99199')
  or exists(select 1 from public.tm_profiles where technician_id='99199') then
  raise exception 'Test ID is in use; choose a new fixture ID';
 end if;
 insert into auth.users(id) values(manager_id),(tech_user),(second_user),(coordinator_id);
 insert into public.tm_profiles(id,username,name,technician_id,role,status) values
 (manager_id,'qa-delete-'||manager_id::text,'Test Manager',null,'Administrator','Active'),
 (tech_user,'qa-delete-'||tech_user::text,'Test Technician','99199','Technician','Active'),
 (second_user,'qa-delete-'||second_user::text,'Second Technician Login','99199','Technician','Active'),
 (coordinator_id,'qa-delete-'||coordinator_id::text,'Test Coordinator','99199','Coordinator','Active');
 insert into public.tm_records(kind,id,technician_id,payload) values('technician','99199','99199','{"id":"99199","name":"Test Technician"}');
 insert into public.tm_records(kind,id,owner_id,technician_id,payload) values
 ('overtime',history_id,tech_user,'99199',jsonb_build_object('ownerId',tech_user::text,'ownerName','Test Technician','hours',2));
 begin
  perform public.tm_save_record(manager_id,'technician','99199','{}',999,true);
  raise exception 'Stale delete unexpectedly succeeded';
 exception when others then if sqlerrm not like 'CONFLICT:%' then raise; end if;
 end;
 if not exists(select 1 from public.tm_profiles where id=tech_user) then raise exception 'Conflict removed login'; end if;
 begin
  perform public.tm_save_record(tech_user,'technician','99199','{}',1,true);
  raise exception 'Technician delete unexpectedly succeeded';
 exception when others then if sqlerrm<>'Access denied' then raise; end if;
 end;
 result:=public.tm_save_record(manager_id,'technician','99199','{}',1,true);
 if jsonb_array_length(result->'deleted_user_ids')<>2 then raise exception 'Missing linked logins'; end if;
 if exists(select 1 from public.tm_profiles where id in (tech_user,second_user)) then raise exception 'Linked profile retained'; end if;
 if exists(select 1 from public.tm_records where kind='technician' and id='99199') then raise exception 'Technician retained'; end if;
 if not exists(select 1 from public.tm_profiles where id=coordinator_id) then raise exception 'Coordinator removed'; end if;
 if not exists(select 1 from public.tm_records where kind='overtime' and id=history_id and owner_id is null and payload->>'ownerId'=tech_user::text and payload->>'ownerName'='Test Technician') then raise exception 'History lost'; end if;
 -- Auth deletion must no longer be blocked by the historical owner FK.
 delete from auth.users where id in (tech_user,second_user);
end $test$;

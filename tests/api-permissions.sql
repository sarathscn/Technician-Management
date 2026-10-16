-- Read-only regression checks for the API-only database access model.
do $test$
begin
 if has_function_privilege('authenticated','public.tm_role()','EXECUTE') or
    has_function_privilege('authenticated','public.tm_technician_id()','EXECUTE') or
    has_function_privilege('anon','public.tm_role()','EXECUTE') then
  raise exception 'Privileged helper functions exposed to clients';
 end if;
 if has_table_privilege('authenticated','public.tm_records','TRUNCATE') or
    has_table_privilege('authenticated','public.tm_records','INSERT') or
    has_table_privilege('authenticated','public.tm_records','SELECT') or
    has_table_privilege('anon','public.tm_profiles','SELECT') then
  raise exception 'Direct client table access exposed';
 end if;
 if not has_function_privilege('service_role','public.tm_save_record(uuid,text,text,jsonb,bigint,boolean)','EXECUTE') or
    not has_table_privilege('service_role','public.tm_records','INSERT') then
  raise exception 'API access broken';
 end if;
end $test$;

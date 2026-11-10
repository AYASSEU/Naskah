SET local check_function_bodies = off;

DROP FUNCTION "public"."accept_revision"(uuid, uuid);

CREATE OR REPLACE FUNCTION public.accept_revision (
  p_owner        uuid,
  p_revision     uuid,
  p_requirements jsonb DEFAULT NULL::jsonb
)
  RETURNS public.sections
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare r public.revision_proposals; s public.sections;
begin
  if p_requirements is not null and jsonb_typeof(p_requirements)<>'array' then raise exception 'invalid_input';end if;
  select * into r from public.revision_proposals where id=p_revision and owner_id=p_owner for update;
  if r.id is null then raise exception 'not_found';end if;
  if r.status<>'pending' or r.after_text is null then raise exception 'revision_not_ready';end if;
  select * into s from public.sections where id=r.section_id and owner_id=p_owner for update;
  if s.locked then raise exception 'section_locked';end if;
  if s.version<>r.base_section_version then raise exception 'section_changed';end if;
  update public.sections set markdown=r.after_text,status='revised',source='ai_revised',version=version+1,
    requirements=coalesce(p_requirements,requirements),guardrail=r.guardrail
    where id=s.id returning * into s;
  update public.revision_proposals set status='accepted',updated_at=now() where id=r.id;
  return s;
end $function$;

REVOKE ALL ON FUNCTION "public"."accept_revision"(uuid, uuid, jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.naskah_workflow_failure (
  p_execution_id text,
  p_session_id   uuid DEFAULT NULL::uuid,
  p_run_id       uuid DEFAULT NULL::uuid,
  p_revision_id  uuid DEFAULT NULL::uuid,
  p_code         text DEFAULT 'unknown'::text,
  p_stage        text DEFAULT 'unknown'::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare l public.srs_generation_logs; r public.revision_proposals; event_scope text; event_ref text;
  callback_id uuid; payload jsonb; code text;
begin
  if p_revision_id is null then
    select * into r from public.revision_proposals where n8n_execution_id=p_execution_id limit 1;
    if r.id is not null then p_revision_id=r.id;p_session_id=r.session_id;end if;
  end if;
  select * into l from public.srs_generation_logs where
    (p_session_id is not null and session_id=p_session_id) or
    (p_session_id is null and n8n_execution_id=p_execution_id) limit 1 for update;
  if l.session_id is null or (p_run_id is not null and p_run_id<>l.run_id) then return '{"ignore":true}';end if;
  code=case when p_code in ('config_missing','integration_not_ready','embedding_dimension_mismatch',
    'embedding_model_mismatch','knowledge_base_empty','retrieval_failed','llm_unauthorized','llm_rate_limited',
    'llm_timeout','llm_invalid_output','guardrail_failed','callback_failed','cancelled','section_locked','section_changed')
    then p_code else 'unknown' end;
  if p_revision_id is null then
    if coalesce(l.metrics->>'watchdog_failed','false')='true' or l.status in ('completed','cancelled') or (l.n8n_execution_id is not null and l.n8n_execution_id<>p_execution_id) then return '{"ignore":true}';end if;
    event_scope='generation';callback_id=coalesce(l.callback_event_id,gen_random_uuid());
    update public.srs_generation_logs set status='failed',error_code=code,failure_stage=left(p_stage,80),
      n8n_execution_id=p_execution_id,callback_event_id=callback_id,finished_at=now(),updated_at=now()
      where session_id=l.session_id;
  else
    select * into r from public.revision_proposals where id=p_revision_id and owner_id=l.owner_id and session_id=l.session_id for update;
    if coalesce(r.metrics->>'watchdog_failed','false')='true' or r.id is null or r.status in ('accepted','rejected','cancelled','pending') or
      (r.n8n_execution_id is not null and r.n8n_execution_id<>p_execution_id) then return '{"ignore":true}';end if;
    event_scope='revision';event_ref=r.id::text;callback_id=coalesce(r.callback_event_id,gen_random_uuid());
    update public.revision_proposals set status='failed',error_code=code,callback_event_id=callback_id,
      n8n_execution_id=p_execution_id,updated_at=now() where id=r.id;
  end if;
  payload=jsonb_build_object('event_id',callback_id,'session_id',l.session_id,'run_id',l.run_id,
    'sent_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'execution_id',p_execution_id,'stage',left(p_stage,80),'code',code,
    'retryable',code in ('retrieval_failed','llm_rate_limited','llm_timeout','llm_invalid_output','guardrail_failed','callback_failed','unknown'));
  if p_revision_id is null then payload=payload||jsonb_build_object('completed_sections',l.completed_sections);
  else payload=payload||jsonb_build_object('revision_id',p_revision_id);end if;
  insert into public.generation_events(event_id,owner_id,session_id,scope,scope_ref,type,payload,workflow_key)
    values(callback_id,l.owner_id,l.session_id,event_scope,event_ref,'failed',
      payload||jsonb_build_object('type','failed','error',jsonb_build_object('code',code,'retryable',payload->'retryable','userMessage','backendErrors.'||code)),
      p_execution_id||':failed') on conflict do nothing;
  return payload;
end $function$;

CREATE OR REPLACE FUNCTION public.naskah_workflow_progress (
  p_session_id         uuid,
  p_run_id             uuid,
  p_revision_id        uuid,
  p_execution_id       text,
  p_event_key          text,
  p_type               text,
  p_payload            jsonb,
  p_completed_sections jsonb DEFAULT NULL::jsonb,
  p_metrics            jsonb DEFAULT '{}'::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare l public.srs_generation_logs; r public.revision_proposals;
  event_scope text; event_ref text; cancel_flag boolean; callback_id uuid;
  entry record; batch_result jsonb; inserted_count integer;
begin
  if p_type='batch' then
    if jsonb_typeof(p_payload->'events')<>'array' or jsonb_array_length(p_payload->'events') not between 1 and 64 then raise exception 'invalid_input';end if;
    for entry in select value,ordinality from jsonb_array_elements(p_payload->'events') with ordinality loop
      if entry.value->>'type'='batch' then raise exception 'invalid_input';end if;
      batch_result=public.naskah_workflow_progress(p_session_id,p_run_id,p_revision_id,p_execution_id,
        p_event_key||':'||entry.ordinality,entry.value->>'type',entry.value,p_completed_sections,p_metrics);
    end loop;
    return batch_result;
  end if;
  select * into l from public.srs_generation_logs where session_id=p_session_id for update;
  if l.session_id is null or l.run_id<>p_run_id then raise exception 'run_not_active'; end if;
  if p_revision_id is null then
    if l.n8n_execution_id is distinct from p_execution_id then raise exception 'run_not_active'; end if;
    if l.status not in ('queued','running') then return jsonb_build_object('ok',true,'cancel_requested',true,'callback_event_id',l.callback_event_id);end if; event_scope='generation';cancel_flag=l.cancel_requested;callback_id=l.callback_event_id;
    update public.srs_generation_logs set current_stage=coalesce(p_payload->>'stage',p_type),
      completed_sections=coalesce(p_completed_sections,completed_sections),
      metrics=metrics||p_metrics,updated_at=now(),
      status=case when p_type='cancelled' then 'cancelled' when p_type='callback_failed' then 'failed' else status end,
      error_code=case when p_type='callback_failed' then 'callback_failed' else error_code end,
      run_status_detail=case when p_type='callback_failed' then 'callback_failed' else run_status_detail end
      where session_id=l.session_id;
  else
    select * into r from public.revision_proposals where id=p_revision_id and session_id=l.session_id and owner_id=l.owner_id for update;
    if r.id is null or r.n8n_execution_id is distinct from p_execution_id then raise exception 'run_not_active'; end if;
    if r.status<>'generating' then return jsonb_build_object('ok',true,'cancel_requested',true,'callback_event_id',r.callback_event_id);end if; event_scope='revision';event_ref=r.id::text;cancel_flag=r.cancel_requested;callback_id=r.callback_event_id;
    update public.revision_proposals set metrics=metrics||p_metrics,updated_at=now(),
      status=case when p_type='cancelled' then 'cancelled' else status end,
      error_code=case when p_type='callback_failed' then 'callback_failed' else error_code end where id=r.id;
  end if;
  if p_type not in ('stage','section_started','section_drafted','guardrail_report','retrieval_context','cancelled','callback_failed')
    or length(p_event_key)>180 then raise exception 'invalid_input'; end if;
  insert into public.generation_events(event_id,owner_id,session_id,scope,scope_ref,type,payload,workflow_key)
    values(gen_random_uuid(),l.owner_id,l.session_id,event_scope,event_ref,p_type,p_payload,p_event_key)
    on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if p_type='retrieval_context' and inserted_count>0 then
    for entry in select value from jsonb_array_elements(coalesce(p_payload->'chunks','[]')) loop
      if entry.value->>'id' ~ '^\d+$' and exists(select 1 from public.srs_knowledge_base where id=(entry.value->>'id')::bigint and owner_id=l.owner_id) then
        insert into public.retrieved_chunk_log(owner_id,session_id,section_id,chunk_id,similarity,provenance)
          select l.owner_id,l.session_id,p_payload->>'sectionId',(entry.value->>'id')::bigint,
            (entry.value->>'similarity')::double precision,entry.value;
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok',true,'cancel_requested',cancel_flag,'callback_event_id',callback_id);
end $function$;

REVOKE ALL ON FUNCTION "public"."accept_revision"(uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."accept_revision"(uuid, uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."accept_revision"(uuid, uuid, jsonb) TO "service_role";

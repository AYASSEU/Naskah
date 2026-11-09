SET local check_function_bodies = off;

DROP FUNCTION "public"."match_srs_chunks"(extensions.vector, integer, text, text, text);

ALTER TABLE "public"."generation_events"
  ADD COLUMN "workflow_key" text;

ALTER TABLE "public"."revision_proposals"
  ADD COLUMN "callback_event_id" uuid;

ALTER TABLE "public"."revision_proposals"
  ADD COLUMN "cancel_requested" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."revision_proposals"
  ADD COLUMN "metrics" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "public"."srs_generation_logs"
  ADD COLUMN "callback_event_id" uuid;

CREATE OR REPLACE FUNCTION public.match_srs_chunks (
  query_embedding extensions.vector,
  match_count     integer           DEFAULT 8,
  filter_section  text              DEFAULT NULL::text,
  filter_domain   text              DEFAULT NULL::text,
  expected_model  text              DEFAULT NULL::text,
  owner_filter    uuid              DEFAULT NULL::uuid
)
  RETURNS TABLE (
    id         bigint,
    content    text,
    metadata   jsonb,
    similarity double precision
  )
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
begin
  if extensions.vector_dims(query_embedding)<>1536 then raise exception 'embedding_dimension_mismatch';end if;
  if expected_model is not null and exists(select 1 from public.srs_knowledge_base where owner_filter is null or owner_id=owner_filter)
    and not exists(select 1 from public.srs_knowledge_base where embedding_model=expected_model and (owner_filter is null or owner_id=owner_filter)) then raise exception 'embedding_model_mismatch';end if;
  return query select k.id,k.content,k.metadata||jsonb_build_object('doc_id',k.doc_id,'dataset_source',k.dataset_source,
    'domain',k.domain,'ieee_section',k.ieee_section,'embedding_model',k.embedding_model),
    1-(k.embedding operator(extensions.<=>) query_embedding) from public.srs_knowledge_base k
    where (filter_section is null or k.ieee_section=filter_section) and (filter_domain is null or k.domain=filter_domain)
      and (expected_model is null or k.embedding_model=expected_model) and (owner_filter is null or k.owner_id=owner_filter)
    order by k.embedding operator(extensions.<=>) query_embedding limit greatest(1,least(match_count,20));
end $function$;

REVOKE ALL ON FUNCTION "public"."match_srs_chunks"(extensions.vector, integer, text, text, text, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.naskah_workflow_context (
  p_session_id   uuid,
  p_execution_id text,
  p_run_id       uuid DEFAULT NULL::uuid,
  p_revision_id  uuid DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare l public.srs_generation_logs; p public.projects; r public.revision_proposals;
  target public.sections; template jsonb; providers jsonb; result jsonb;
begin
  select * into l from public.srs_generation_logs where session_id=p_session_id for update;
  if l.session_id is null then raise exception 'not_found'; end if;
  if p_run_id is not null and l.run_id<>p_run_id then raise exception 'run_not_active'; end if;
  select * into p from public.projects where id=l.project_id and owner_id=l.owner_id;
  select value into template from public.app_config where key='template:'||p.template_id;
  select jsonb_object_agg(provider,config) into providers from public.integration_secrets
    where owner_id=l.owner_id and provider in ('deepseek','embeddings') and status='ready';
  if template is null then raise exception 'config_missing'; end if;
  if providers is null or not(providers ? 'deepseek' and providers ? 'embeddings') then raise exception 'integration_not_ready'; end if;
  result=jsonb_build_object('session_id',l.session_id,'run_id',l.run_id,'project_id',p.id,'owner_id',l.owner_id,'is_thesis_run',l.is_thesis_run,
    'project_title',p.title,'domain',p.domain,'output_language',p.output_language,
    'template_id',p.template_id,'template',template,'providers',providers,
    'generation',(select value from public.app_config where key='generation'),
    'embedding',(select value from public.app_config where key='embeddings'),
    'prompts',(select jsonb_agg(jsonb_build_object('chapter',chapter,'body',body,'version',version))
      from public.prompt_templates where active));
  if p_revision_id is null then
    if l.status not in ('queued','running') then raise exception 'run_not_active'; end if;
    if l.status='running' and l.n8n_execution_id is not null and l.n8n_execution_id<>p_execution_id then raise exception 'run_not_active'; end if;
    update public.srs_generation_logs set status='running',n8n_execution_id=p_execution_id,
      callback_event_id=case when n8n_execution_id is distinct from p_execution_id or callback_event_id is null then gen_random_uuid() else callback_event_id end,
      updated_at=now() where session_id=l.session_id returning * into l;
    return result||jsonb_build_object('raw_text',p.raw_text,'completed_sections',l.completed_sections,
      'cancel_requested',l.cancel_requested,'callback_event_id',l.callback_event_id);
  end if;
  select * into r from public.revision_proposals where id=p_revision_id and session_id=l.session_id
    and owner_id=l.owner_id and project_id=p.id for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status<>'generating' or (r.n8n_execution_id is not null and r.n8n_execution_id<>p_execution_id) then raise exception 'run_not_active'; end if;
  select * into target from public.sections where id=r.section_id and owner_id=r.owner_id;
  if target.locked then raise exception 'section_locked'; end if;
  if target.version<>r.base_section_version then raise exception 'section_changed'; end if;
  update public.revision_proposals set n8n_execution_id=p_execution_id,
    callback_event_id=coalesce(callback_event_id,gen_random_uuid()),updated_at=now()
    where id=r.id returning * into r;
  return result||jsonb_build_object('cancel_requested',r.cancel_requested,'callback_event_id',r.callback_event_id,
    'revision',jsonb_build_object('id',r.id,'target_section',target.section_id,'number',target.number,
      'title',target.title,'current_section_text',r.before_text,'user_instructions',r.instruction,
      'base_section_version',r.base_section_version,'reserved_ids',coalesce((select jsonb_agg(req->>'id')
        from public.sections s cross join lateral jsonb_array_elements(s.requirements) req
        where s.project_id=p.id and s.owner_id=l.owner_id and s.id<>target.id),'[]')));
end $function$;

REVOKE ALL ON FUNCTION "public"."naskah_workflow_context"(uuid, text, uuid, uuid) FROM PUBLIC, "anon", "authenticated";

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
    if l.status in ('completed','cancelled') or (l.n8n_execution_id is not null and l.n8n_execution_id<>p_execution_id) then return '{"ignore":true}';end if;
    event_scope='generation';callback_id=coalesce(l.callback_event_id,gen_random_uuid());
    update public.srs_generation_logs set status='failed',error_code=code,failure_stage=left(p_stage,80),
      n8n_execution_id=p_execution_id,callback_event_id=callback_id,finished_at=now(),updated_at=now()
      where session_id=l.session_id;
  else
    select * into r from public.revision_proposals where id=p_revision_id and owner_id=l.owner_id and session_id=l.session_id for update;
    if r.id is null or r.status in ('accepted','rejected','cancelled','pending') or
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

REVOKE ALL ON FUNCTION "public"."naskah_workflow_failure"(text, uuid, uuid, uuid, text, text) FROM PUBLIC, "anon", "authenticated";

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
    event_scope='generation';cancel_flag=l.cancel_requested;callback_id=l.callback_event_id;
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
    event_scope='revision';event_ref=r.id::text;cancel_flag=r.cancel_requested;callback_id=r.callback_event_id;
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

REVOKE ALL ON FUNCTION "public"."naskah_workflow_progress"(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE UNIQUE INDEX workflow_event_once ON public.generation_events USING btree (session_id, scope, COALESCE(scope_ref, ''::text), workflow_key)
  WHERE (workflow_key IS NOT NULL);

REVOKE ALL ON FUNCTION "public"."match_srs_chunks"(extensions.vector, integer, text, text, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."match_srs_chunks"(extensions.vector, integer, text, text, text, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."match_srs_chunks"(extensions.vector, integer, text, text, text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."naskah_workflow_context"(uuid, text, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."naskah_workflow_context"(uuid, text, uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."naskah_workflow_context"(uuid, text, uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."naskah_workflow_failure"(text, uuid, uuid, uuid, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."naskah_workflow_failure"(text, uuid, uuid, uuid, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."naskah_workflow_failure"(text, uuid, uuid, uuid, text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."naskah_workflow_progress"(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."naskah_workflow_progress"(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."naskah_workflow_progress"(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb) TO "service_role";


-- Template data is required by the workflow context RPC.
insert into public.app_config(key,value,description) values
('template:ieee-830-1998','{"id":"ieee-830-1998","name":"IEEE 830-1998","chapters":[{"number":"1","title":"Introduction","subsections":[{"number":"1.1","title":"Purpose (Tujuan)","required":true},{"number":"1.2","title":"Scope (Ruang lingkup)","required":true},{"number":"1.3","title":"Glossary (Glosarium)","required":true},{"number":"1.4","title":"References (Referensi)","required":true}]},{"number":"2","title":"Overall Description","subsections":[{"number":"2.1","title":"Product perspective","required":true},{"number":"2.2","title":"User classes","required":true},{"number":"2.3","title":"Operating environment","required":true},{"number":"2.4","title":"Constraints and assumptions","required":true}]},{"number":"3","title":"Specific Requirements","subsections":[{"number":"3.1","title":"External interfaces","required":true},{"number":"3.2","title":"Functional Requirements","required":true},{"number":"3.3","title":"Performance requirements","required":true},{"number":"3.4","title":"Security requirements","required":true},{"number":"3.5","title":"Software attributes","required":true}]},{"number":"4","title":"Supporting Artifacts","subsections":[{"number":"4.1","title":"Use Case Narratives","required":true},{"number":"4.2","title":"Requirements Traceability Matrix","required":true}]}]}',
 'Active template is data; new templates do not require editing the n8n graph')
on conflict(key) do nothing;

-- Replaces the never-applied Phase 1 scaffold; see ADR 002.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  session_id uuid not null unique default gen_random_uuid(),
  title text not null check (length(title) between 1 and 300), domain text not null,
  version text not null default '0.1',
  status text not null default 'draft_input' check (status in ('draft_input','generating','in_review','finalized','failed')),
  raw_text text not null default '', output_language text not null default 'id' check (output_language in ('id','en')),
  template_id text not null default 'ieee-830-1998',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id, owner_id)
);
create table public.project_inputs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  project_id uuid not null, raw_text text not null default '', files jsonb not null default '[]',
  created_at timestamptz not null default now(),
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.documents (
  project_id uuid primary key, owner_id uuid not null, template_id text not null,
  metadata jsonb not null default '{}', chunks jsonb not null default '[]',
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.sections (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, project_id uuid not null,
  section_id text not null, number text not null, title text not null, markdown text not null default '',
  status text not null default 'pending' check (status in ('pending','generating','drafted','edited','revised','locked')),
  source text not null default 'ai' check (source in ('ai','human','ai_revised')),
  locked boolean not null default false, version integer not null default 1 check (version > 0),
  requirements jsonb not null default '[]', guardrail jsonb not null default '{"dimensions":[],"rewrites":[]}',
  updated_at timestamptz not null default now(), unique(project_id,section_id), unique(id,owner_id),
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.section_versions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, section_id uuid not null,
  version integer not null, snapshot jsonb not null, label text not null default 'Saved',
  created_at timestamptz not null default now(), unique(section_id,version),
  foreign key (section_id,owner_id) references public.sections(id,owner_id) on delete cascade
);
create table public.document_versions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, project_id uuid not null,
  label text not null, sections jsonb not null, created_at timestamptz not null default now(),
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.revision_proposals (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, project_id uuid not null,
  section_id uuid not null, session_id uuid not null, before_text text not null, after_text text,
  instruction text not null, refined_query text not null default '', base_section_version integer not null,
  status text not null default 'generating' check (status in ('generating','pending','accepted','rejected','failed','cancelled')),
  retrieved_chunks jsonb not null default '[]', guardrail jsonb not null default '{"dimensions":[],"rewrites":[]}',
  n8n_execution_id text, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
  foreign key (section_id,owner_id) references public.sections(id,owner_id) on delete cascade
);
create unique index one_open_revision_per_section on public.revision_proposals(section_id) where status in ('generating','pending');
create table public.srs_generation_logs (
  session_id uuid primary key default gen_random_uuid(), owner_id uuid not null, project_id uuid not null,
  project_title text not null, domain text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  run_id uuid not null default gen_random_uuid(), run_status_detail text, current_stage text,
  n8n_execution_id text, model text, embedding_model text, retrieval_k integer check (retrieval_k between 1 and 20),
  tokens_in integer not null default 0, tokens_out integer not null default 0,
  guardrail_rewrite_count integer not null default 0, failure_stage text, error_code text, error_message text,
  cancel_requested boolean not null default false, completed_sections jsonb not null default '[]',
  execution_time_seconds double precision not null default 0,
  structure_completeness_pct double precision not null default 0 check (structure_completeness_pct between 0 and 100),
  scenario_label text, is_thesis_run boolean not null default false, metrics jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), finished_at timestamptz,
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.generation_events (
  seq bigint generated always as identity primary key, event_id uuid not null unique,
  owner_id uuid not null, session_id uuid not null references public.srs_generation_logs(session_id) on delete cascade,
  scope text not null check (scope in ('generation','revision')), scope_ref text,
  type text not null, payload jsonb not null,
  created_at timestamptz not null default now(),
  check ((scope='generation' and scope_ref is null) or (scope='revision' and scope_ref is not null))
);
create index generation_events_session_seq on public.generation_events(session_id,seq);
create table public.callback_receipts (
  event_id uuid primary key, owner_id uuid not null,
  session_id uuid not null references public.srs_generation_logs(session_id) on delete cascade,
  kind text not null, payload_hash text not null, created_at timestamptz not null default now()
);
create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, dataset_source text not null,
  manifest jsonb not null default '{}', counts jsonb not null default '{}', embedding_model text not null,
  dimensions integer not null check (dimensions=1536), cost_estimate numeric, status text not null,
  created_at timestamptz not null default now(), finished_at timestamptz
);
-- Held-out documents have no vector column and cannot be retrieved by the RPC.
create table public.ground_truth_docs (
  doc_id text primary key, owner_id uuid not null, dataset_source text not null, content text not null,
  language text not null check (language in ('id','en')), metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.srs_knowledge_base (
  id bigserial primary key, owner_id uuid not null, content text not null, metadata jsonb not null default '{}',
  embedding extensions.vector(1536) not null, doc_id text not null, dataset_source text not null,
  domain text, ieee_section text not null default 'unknown', chunk_index integer not null,
  token_count integer not null check (token_count > 0), split text not null default 'kb' check (split = 'kb'),
  embedding_model text not null, dimensions integer not null default 1536 check (dimensions=1536),
  content_hash text not null unique, ingestion_run_id uuid references public.ingestion_runs(id),
  created_at timestamptz not null default now()
);
create index srs_knowledge_embedding on public.srs_knowledge_base using hnsw (embedding extensions.vector_cosine_ops);
create index srs_knowledge_doc on public.srs_knowledge_base(doc_id);
create index srs_knowledge_model_section on public.srs_knowledge_base(embedding_model,ieee_section);
create table public.retrieved_chunk_log (
  id bigint generated always as identity primary key, owner_id uuid not null,
  session_id uuid not null references public.srs_generation_logs(session_id) on delete cascade,
  section_id text, chunk_id bigint references public.srs_knowledge_base(id) on delete set null,
  similarity double precision not null, provenance jsonb not null default '{}'
);
create table public.guardrail_reports (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  session_id uuid not null references public.srs_generation_logs(session_id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  dimensions jsonb not null, rewrites jsonb not null default '[]', created_at timestamptz not null default now()
);
create table public.prompt_templates (
  id text not null, version integer not null, chapter text not null, body text not null,
  active boolean not null default true, primary key(id,version)
);
create unique index one_active_prompt on public.prompt_templates(chapter) where active;
create table public.app_config (key text primary key, value jsonb not null, description text not null);
create table public.participants (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, code text not null unique,
  consent boolean not null check (consent), consent_at timestamptz not null, role text not null check (role in ('expert','participant')),
  created_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.blind_assignments (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, participant_id uuid not null,
  project_id uuid not null, label text not null check (label in ('A','B')), source text not null,
  markdown text not null, is_thesis_run boolean not null default false,
  unique(participant_id,project_id,label),
  foreign key (participant_id,owner_id) references public.participants(id,owner_id) on delete cascade,
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.expert_reviews (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, participant_id uuid not null,
  assignment_id uuid not null unique references public.blind_assignments(id) on delete cascade,
  reviewer text not null, label text not null check (label in ('A','B')),
  ratings jsonb not null check (jsonb_array_length(ratings)=4),
  justifications jsonb not null check (jsonb_array_length(justifications)=4), comments text not null default '',
  is_thesis_run boolean not null default false, created_at timestamptz not null default now(),
  foreign key (participant_id,owner_id) references public.participants(id,owner_id) on delete cascade
);
create table public.sus_responses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, participant_id uuid not null,
  project_id uuid, answers jsonb not null check (jsonb_array_length(answers)=10), score numeric not null check (score between 0 and 100),
  comment text not null default '', is_thesis_run boolean not null default false, created_at timestamptz not null default now(),
  foreign key (participant_id,owner_id) references public.participants(id,owner_id) on delete cascade,
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.rouge_results (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, project_id uuid,
  scenario text not null, rouge1 jsonb not null, rouge2 jsonb not null, rouge_l jsonb not null,
  language text not null, reference_language text not null, language_mismatch_override boolean not null default false,
  is_thesis_run boolean not null default false, provenance jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (language=reference_language or language_mismatch_override),
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table public.statistical_results (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  result jsonb not null, is_thesis_run boolean not null default false, created_at timestamptz not null default now()
);
create table public.integration_secrets (
  owner_id uuid not null, provider text not null, ciphertext text not null, iv text not null, tag text not null,
  key_version integer not null default 1, key_hint text not null check (length(key_hint)<=4),
  config jsonb not null default '{}', status text not null default 'stored',
  last_tested_at timestamptz, last_error_code text, updated_at timestamptz not null default now(),
  primary key(owner_id,provider)
);
create table public.n8n_bindings (
  owner_id uuid not null, provider text not null, credential_id text, credential_name text not null,
  credential_type text not null, rebound jsonb not null default '[]', workflows jsonb not null default '[]',
  status text not null default 'pending', last_tested_at timestamptz, updated_at timestamptz not null default now(),
  primary key(owner_id,provider)
);
create table public.audit_log (
  id bigint generated always as identity primary key, owner_id uuid not null, action text not null,
  resource text not null, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.exports (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, project_id uuid not null,
  object_path text not null unique, format text not null check (format in ('docx','pdf')),
  filename text not null, size bigint not null, created_at timestamptz not null default now(),
  foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);

-- Serialize split writes by doc_id, including concurrent ingestion/held-out loads.
create function public.prevent_corpus_leakage() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.doc_id,0));
  if tg_table_name='srs_knowledge_base' then
    if exists(select 1 from public.ground_truth_docs where doc_id=new.doc_id) then raise exception 'corpus_leakage'; end if;
  else
    if exists(select 1 from public.srs_knowledge_base where doc_id=new.doc_id) then raise exception 'corpus_leakage'; end if;
  end if;
  return new;
end $$;
create trigger kb_no_leak before insert or update of doc_id on public.srs_knowledge_base for each row execute function public.prevent_corpus_leakage();
create trigger truth_no_leak before insert or update of doc_id on public.ground_truth_docs for each row execute function public.prevent_corpus_leakage();

create function public.protect_section() returns trigger language plpgsql set search_path='' as $$
begin
  if old.locked and (new.markdown is distinct from old.markdown or new.requirements is distinct from old.requirements) then raise exception 'section_locked'; end if;
  if new.project_id<>old.project_id or new.owner_id<>old.owner_id or new.section_id<>old.section_id then raise exception 'section_identity_immutable'; end if;
  if new.version<>old.version+1 then raise exception 'section_changed'; end if;
  insert into public.section_versions(owner_id,section_id,version,snapshot) values(old.owner_id,old.id,old.version,to_jsonb(old));
  new.updated_at=now();
  return new;
end $$;
create trigger section_version_guard before update on public.sections for each row execute function public.protect_section();

create function public.protect_revision() returns trigger language plpgsql set search_path='' as $$
declare s public.sections;
begin
  select * into s from public.sections where id=new.section_id for update;
  if s.id is null or s.owner_id<>new.owner_id or s.project_id<>new.project_id then raise exception 'section_not_found'; end if;
  if s.locked then raise exception 'section_locked'; end if;
  if s.version<>new.base_section_version then raise exception 'section_changed'; end if;
  return new;
end $$;
create trigger revision_guard before insert on public.revision_proposals for each row execute function public.protect_revision();

create function public.save_section(p_owner uuid, p_project uuid, p_section text, p_version integer, p_data jsonb)
returns public.sections language plpgsql set search_path='' as $$
declare s public.sections;
begin
  select * into s from public.sections where project_id=p_project and section_id=p_section and owner_id=p_owner for update;
  if s.id is null then raise exception 'not_found'; end if;
  if s.version<>p_version then raise exception 'section_changed'; end if;
  update public.sections set markdown=p_data->>'markdown', status=p_data->>'status', source=p_data->>'source',
    locked=coalesce((p_data->>'locked')::boolean,(p_data->>'status')='locked'),
    requirements=coalesce(p_data->'requirements','[]'),guardrail=coalesce(p_data->'guardrail',s.guardrail),version=version+1
    where id=s.id returning * into s;
  return s;
end $$;
create function public.accept_revision(p_owner uuid,p_revision uuid) returns public.sections language plpgsql set search_path='' as $$
declare r public.revision_proposals; s public.sections;
begin
  select * into r from public.revision_proposals where id=p_revision and owner_id=p_owner for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status<>'pending' or r.after_text is null then raise exception 'revision_not_ready'; end if;
  select * into s from public.sections where id=r.section_id and owner_id=p_owner for update;
  if s.locked then raise exception 'section_locked'; end if;
  if s.version<>r.base_section_version then raise exception 'section_changed'; end if;
  update public.sections set markdown=r.after_text,status='revised',source='ai_revised',version=version+1,guardrail=r.guardrail
    where id=s.id returning * into s;
  update public.revision_proposals set status='accepted',updated_at=now() where id=r.id;
  return s;
end $$;

create function public.match_srs_chunks(query_embedding extensions.vector(1536), match_count integer default 8,
  filter_section text default null, filter_domain text default null, expected_model text default null)
returns table(id bigint, content text, metadata jsonb, similarity double precision)
language plpgsql stable set search_path='' as $$
begin
  if extensions.vector_dims(query_embedding)<>1536 then raise exception 'embedding_dimension_mismatch'; end if;
  if expected_model is not null and exists(select 1 from public.srs_knowledge_base)
    and not exists(select 1 from public.srs_knowledge_base where embedding_model=expected_model) then
    raise exception 'embedding_model_mismatch';
  end if;
  return query select k.id,k.content,k.metadata || jsonb_build_object('doc_id',k.doc_id,'dataset_source',k.dataset_source,
    'domain',k.domain,'ieee_section',k.ieee_section,'embedding_model',k.embedding_model),
    1-(k.embedding operator(extensions.<=>) query_embedding)
    from public.srs_knowledge_base k
    where (filter_section is null or k.ieee_section=filter_section)
      and (filter_domain is null or k.domain=filter_domain)
      and (expected_model is null or k.embedding_model=expected_model)
    order by k.embedding operator(extensions.<=>) query_embedding limit greatest(1,least(match_count,20));
end $$;

-- Every public table is closed to anon. User-owned rows are scoped for future Auth.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security',t.tablename);
    execute format('revoke all on public.%I from anon,authenticated',t.tablename);
    execute format('grant all on public.%I to service_role',t.tablename);
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='owner_id')
      and t.tablename not in ('integration_secrets','n8n_bindings','audit_log','blind_assignments','callback_receipts') then
      execute format('grant select,insert,update,delete on public.%I to authenticated',t.tablename);
      execute format('create policy owner_access on public.%I to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',t.tablename);
    end if;
  end loop;
end $$;
grant usage on schema extensions to service_role,authenticated;
grant usage,select on all sequences in schema public to service_role;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;

-- Index foreign keys and owner predicates used by RLS; avoid unindexed cascade scans.
do $$ declare c record; begin
  for c in select table_name,column_name from information_schema.columns where table_schema='public'
    and column_name in ('owner_id','project_id','session_id','section_id','participant_id','ingestion_run_id','chunk_id') loop
    execute format('create index if not exists %I on public.%I(%I)',c.table_name||'_'||c.column_name||'_idx',c.table_name,c.column_name);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('exports','exports',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;

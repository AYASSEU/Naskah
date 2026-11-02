-- Inert Phase 2 scaffold. Not applied in Phase 1.
create extension if not exists vector;
create extension if not exists pgcrypto;
create table srs_knowledge_base (
 id uuid primary key default gen_random_uuid(), dataset text not null,
 source_document text not null, split text check(split in ('train','test')) not null,
 section text, content text not null,
 embedding vector(1536) -- Match the selected embedding model dimension before applying.
);
create index srs_knowledge_embedding on srs_knowledge_base using hnsw (embedding vector_cosine_ops);
-- ProjectSchema in packages/contracts/src/index.ts
create table projects (id uuid primary key, owner_id uuid not null, session_id uuid unique not null, title text not null, domain text not null, version text not null default '0.1', status text not null, raw_text text not null, created_at timestamptz default now(), updated_at timestamptz default now());
-- SectionSchema: JSONB preserves parsed requirements and guardrail reports.
create table sections (id uuid primary key default gen_random_uuid(), project_id uuid references projects(id) on delete cascade, section_id text not null, number text not null, title text not null, markdown text not null, status text not null, source text not null, requirements jsonb not null default '[]', guardrail jsonb not null, updated_at timestamptz default now(), unique(project_id,section_id));
-- VersionSchema. Treat snapshots as immutable.
create table document_versions (id uuid primary key, project_id uuid references projects(id) on delete cascade, label text not null, sections jsonb not null, created_at timestamptz default now());
-- GenerationLogSchema; one terminal log per session/execution, enforce callback idempotency.
create table srs_generation_logs (session_id uuid primary key, project_title text not null, domain text not null, status text not null, execution_time_seconds numeric not null, structure_completeness_pct numeric check(structure_completeness_pct between 0 and 100), created_at timestamptz default now());
-- ExpertReviewSchema. Store blind mapping separately from participant-visible records.
create table expert_reviews (id uuid primary key, reviewer text not null, label text check(label in ('A','B')), ratings jsonb not null, justifications jsonb not null, comments text, created_at timestamptz default now());
-- SusResponseSchema
create table sus_responses (id uuid primary key, answers jsonb not null, score numeric check(score between 0 and 100), comment text, created_at timestamptz default now());
-- RougeSchema
create table rouge_results (id uuid primary key default gen_random_uuid(), scenario text not null, rouge1 jsonb not null, rouge2 jsonb not null, rouge_l jsonb not null);
-- Before deployment: enable RLS on all tables and implement owner-scoped policies.
-- Never expose the service-role key to the browser. No public write policies here.

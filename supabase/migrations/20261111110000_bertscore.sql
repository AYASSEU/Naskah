create table public.bertscore_results (
 owner_id uuid not null, case_id uuid not null, input_digest text not null,
 is_thesis_run boolean not null, precision_score double precision not null,
 recall_score double precision not null, f1 double precision not null, provenance jsonb not null,
 primary key(owner_id,case_id,input_digest),
 foreign key(case_id,owner_id) references public.evaluation_cases(id,owner_id) on delete cascade
);
alter table public.bertscore_results enable row level security;
revoke all on public.bertscore_results from anon, authenticated;

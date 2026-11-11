SET local check_function_bodies = off;

ALTER TABLE "public"."blind_assignments"
  DROP CONSTRAINT "blind_assignments_participant_id_project_id_label_key";

ALTER TABLE "public"."participants"
  DROP CONSTRAINT "participants_code_key";

CREATE TABLE "public"."blind_source_maps" (
  "assignment_id" uuid NOT NULL,
  "owner_id"      uuid NOT NULL,
  "source"        text NOT NULL,
  CONSTRAINT "blind_source_maps_pkey" PRIMARY KEY (assignment_id),
  CONSTRAINT "blind_source_maps_source_check" CHECK ((source = ANY (ARRAY['system'::text, 'human'::text])))
);

ALTER TABLE "public"."blind_source_maps"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."blind_source_maps" FROM "anon", "authenticated";

CREATE TABLE "public"."evaluation_cases" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "owner_id"           uuid                     NOT NULL,
  "project_id"         uuid                     NOT NULL,
  "title"              text                     NOT NULL,
  "system_markdown"    text                     NOT NULL,
  "human_markdown"     text                     NOT NULL,
  "language"           text                     NOT NULL,
  "reference_language" text                     NOT NULL,
  "provenance"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "is_thesis_run"      boolean                  NOT NULL DEFAULT false,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "study_design"       text                     NOT NULL DEFAULT 'paired'::text,
  CONSTRAINT "evaluation_cases_id_owner_id_key" UNIQUE (id, owner_id),
  CONSTRAINT "evaluation_cases_language_check" CHECK ((language = ANY (ARRAY['id'::text, 'en'::text]))),
  CONSTRAINT "evaluation_cases_pkey" PRIMARY KEY (id),
  CONSTRAINT "evaluation_cases_reference_language_check" CHECK ((reference_language = ANY (ARRAY['id'::text, 'en'::text]))),
  CONSTRAINT "evaluation_cases_study_design_check" CHECK ((study_design = ANY (ARRAY['paired'::text, 'independent'::text])))
);

ALTER TABLE "public"."evaluation_cases"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."evaluation_cases" FROM "anon", "authenticated";

ALTER TABLE "public"."blind_assignments"
  ADD COLUMN "case_id" uuid;

ALTER TABLE "public"."participants"
  ADD COLUMN "is_thesis_run" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."rouge_results"
  ADD COLUMN "case_id" uuid;

CREATE OR REPLACE FUNCTION public.calculate_sus_score (
  answers jsonb
)
  RETURNS numeric
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare total integer:=0;value jsonb;position integer:=0;n numeric;
begin
 if answers is null or jsonb_typeof(answers)<>'array' or jsonb_array_length(answers)<>10 then raise exception 'invalid_input';end if;
 for value in select * from jsonb_array_elements(answers) loop
  if jsonb_typeof(value)<>'number' then raise exception 'invalid_input';end if;
  n:=value::text::numeric;
  if n<>trunc(n) or n<1 or n>5 then raise exception 'invalid_input';end if;
  total:=total+case when position%2=0 then n-1 else 5-n end;position:=position+1;
 end loop;
 return total*2.5;
end $function$;

REVOKE ALL ON FUNCTION "public"."calculate_sus_score"(jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.reject_evaluation_update()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin raise exception 'evaluation_immutable';end $function$;

REVOKE ALL ON FUNCTION "public"."reject_evaluation_update"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.validate_evaluation_case()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare run public.srs_generation_logs;person public.participants;the_case public.evaluation_cases;
begin
 if tg_op='UPDATE' then raise exception 'evaluation_immutable';end if;
 if tg_table_name='evaluation_cases' then
  if new.is_thesis_run then
   select * into run from public.srs_generation_logs where project_id=new.project_id and owner_id=new.owner_id;
   if not found or not run.is_thesis_run or run.status<>'completed' or run.metrics::text like '%mock%' or new.provenance->>'dev_seed'='true' then raise exception 'dev_seed_excluded';end if;
   if exists(select 1 from public.retrieved_chunk_log r join public.srs_knowledge_base k on k.id=r.chunk_id where r.session_id=run.session_id and r.owner_id=new.owner_id and (k.dataset_source='dev_seed' or k.metadata->>'dev_seed'='true')) then raise exception 'dev_seed_excluded';end if;
   if new.language<>new.reference_language then raise exception 'language_mismatch';end if;
  end if;
 else
  select * into person from public.participants where id=new.participant_id and owner_id=new.owner_id;
  select * into the_case from public.evaluation_cases where id=new.case_id and owner_id=new.owner_id;
  if person.id is null or the_case.id is null or person.is_thesis_run<>new.is_thesis_run or the_case.is_thesis_run<>new.is_thesis_run or the_case.project_id<>new.project_id or person.role<>'expert' then raise exception 'evaluation_scope_mismatch';end if;
  new.source:='blinded';
 end if;
 return new;
end $function$;

REVOKE ALL ON FUNCTION "public"."validate_evaluation_case"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.validate_evaluation_record()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare person public.participants;assignment public.blind_assignments;item jsonb;run public.srs_generation_logs;
begin
 if tg_op='UPDATE' then raise exception 'evaluation_immutable';end if;
 select * into person from public.participants where id=new.participant_id and owner_id=new.owner_id;
 if not found or not person.consent then raise exception 'research_consent_required';end if;
 if person.is_thesis_run<>new.is_thesis_run then raise exception 'evaluation_scope_mismatch';end if;
 if tg_table_name='sus_responses' then
  new.score:=public.calculate_sus_score(new.answers);
  if new.is_thesis_run then
   select * into run from public.srs_generation_logs where project_id=new.project_id and owner_id=new.owner_id;
   if not found or not run.is_thesis_run or run.status<>'completed' or run.metrics::text like '%mock%' then raise exception 'dev_seed_excluded';end if; if exists(select 1 from public.retrieved_chunk_log r join public.srs_knowledge_base k on k.id=r.chunk_id where r.session_id=run.session_id and r.owner_id=new.owner_id and (k.dataset_source='dev_seed' or k.metadata->>'dev_seed'='true')) then raise exception 'dev_seed_excluded';end if;
  end if;
 else
  select * into assignment from public.blind_assignments where id=new.assignment_id and owner_id=new.owner_id;
  if not found or assignment.participant_id<>person.id or assignment.label<>new.label or assignment.is_thesis_run<>new.is_thesis_run then raise exception 'evaluation_scope_mismatch';end if;
  if person.role<>'expert' then raise exception 'expert_role_required';end if;
  if jsonb_typeof(new.ratings)<>'array' or jsonb_array_length(new.ratings)<>4 or jsonb_typeof(new.justifications)<>'array' or jsonb_array_length(new.justifications)<>4 then raise exception 'invalid_input';end if;
  for item in select * from jsonb_array_elements(new.ratings) loop
   if jsonb_typeof(item)<>'number' or item::text::numeric<>trunc(item::text::numeric) or item::text::numeric not between 1 and 5 then raise exception 'invalid_input';end if;
  end loop;
  for item in select * from jsonb_array_elements(new.justifications) loop
   if jsonb_typeof(item)<>'string' or length(btrim(item#>>'{}'))=0 then raise exception 'invalid_input';end if;
  end loop;
  new.reviewer:=person.code;
 end if;
 new.created_at:=now();return new;
end $function$;

REVOKE ALL ON FUNCTION "public"."validate_evaluation_record"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.validate_evaluation_result()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare c public.evaluation_cases;
begin
 if tg_op='UPDATE' then raise exception 'evaluation_immutable';end if;
 if new.is_thesis_run then
  if tg_table_name='rouge_results' then
   select * into c from public.evaluation_cases where id=new.case_id and owner_id=new.owner_id;
   if not found or not c.is_thesis_run or c.project_id<>new.project_id or new.language_mismatch_override or new.language<>new.reference_language or new.language<>c.language or new.reference_language<>c.reference_language then raise exception 'dev_seed_excluded';end if;
   if coalesce(new.provenance->>'input_digest','')!~'^[a-f0-9]{64}$' then raise exception 'evaluation_provenance_mismatch';end if;
  else
   if new.result->>'kind' is distinct from 'statistics' or new.result->>'data_scope' is distinct from 'research' or coalesce(new.result->'provenance'->>'input_digest','')!~'^[a-f0-9]{64}$' then raise exception 'evaluation_scope_mismatch';end if;
  end if;
 end if;
 return new;
end $function$;

REVOKE ALL ON FUNCTION "public"."validate_evaluation_result"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."blind_assignments"
  ADD CONSTRAINT "blind_assignment_owner" UNIQUE (id, owner_id);

ALTER TABLE "public"."blind_source_maps"
  ADD CONSTRAINT "blind_source_maps_assignment_id_owner_id_fkey" FOREIGN KEY (assignment_id, owner_id) REFERENCES public.blind_assignments(id, owner_id) ON DELETE CASCADE;

ALTER TABLE "public"."blind_assignments"
  ADD CONSTRAINT "blind_case_owner" FOREIGN KEY (case_id, owner_id) REFERENCES public.evaluation_cases(id, owner_id) ON DELETE CASCADE;

ALTER TABLE "public"."evaluation_cases"
  ADD CONSTRAINT "evaluation_cases_project_id_owner_id_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES public.projects(id, owner_id) ON DELETE CASCADE;

ALTER TABLE "public"."participants"
  ADD CONSTRAINT "participant_scope_code" UNIQUE (owner_id, is_thesis_run, code);

ALTER TABLE "public"."rouge_results"
  ADD CONSTRAINT "rouge_case_owner" FOREIGN KEY (case_id, owner_id) REFERENCES public.evaluation_cases(id, owner_id) ON DELETE CASCADE;

CREATE INDEX blind_assignment_case ON public.blind_assignments USING btree (case_id, owner_id);

CREATE UNIQUE INDEX blind_case_label ON public.blind_assignments USING btree (participant_id, case_id, label);

CREATE INDEX evaluation_case_project ON public.evaluation_cases USING btree (project_id, owner_id);

CREATE INDEX evaluation_case_scope ON public.evaluation_cases USING btree (owner_id, is_thesis_run, created_at);

CREATE INDEX expert_review_scope ON public.expert_reviews USING btree (owner_id, is_thesis_run, created_at);

CREATE INDEX rouge_case_index ON public.rouge_results USING btree (case_id, owner_id);

CREATE INDEX rouge_scope ON public.rouge_results USING btree (owner_id, is_thesis_run, created_at);

CREATE INDEX source_map_owner ON public.blind_source_maps USING btree (owner_id);

CREATE INDEX statistics_scope ON public.statistical_results USING btree (owner_id, is_thesis_run, created_at);

CREATE UNIQUE INDEX sus_one_participant ON public.sus_responses USING btree (participant_id);

CREATE INDEX sus_response_scope ON public.sus_responses USING btree (owner_id, is_thesis_run, created_at);

CREATE TRIGGER validate_blind_assignment_row
  BEFORE INSERT OR UPDATE ON public.blind_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_evaluation_case();

CREATE TRIGGER immutable_source_mapping
  BEFORE UPDATE ON public.blind_source_maps
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_evaluation_update();

CREATE TRIGGER validate_evaluation_case_row
  BEFORE INSERT OR UPDATE ON public.evaluation_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_evaluation_case();

CREATE TRIGGER validate_expert_record
  BEFORE INSERT OR UPDATE ON public.expert_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_evaluation_record();

CREATE TRIGGER validate_rouge_result
  BEFORE INSERT OR UPDATE ON public.rouge_results
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_evaluation_result();

CREATE TRIGGER validate_statistics_result
  BEFORE INSERT OR UPDATE ON public.statistical_results
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_evaluation_result();

CREATE TRIGGER validate_sus_record
  BEFORE INSERT OR UPDATE ON public.sus_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_evaluation_record();

CREATE POLICY "owner_blind_source_maps" ON "public"."blind_source_maps"
  FOR ALL
  TO "authenticated"
  USING ((owner_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "owner_evaluation_cases" ON "public"."evaluation_cases"
  FOR ALL
  TO "authenticated"
  USING ((owner_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));

REVOKE ALL ON FUNCTION "public"."calculate_sus_score"(jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."calculate_sus_score"(jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."calculate_sus_score"(jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reject_evaluation_update"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_evaluation_update"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_evaluation_update"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_evaluation_case"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_evaluation_case"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_evaluation_case"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_evaluation_record"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_evaluation_record"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_evaluation_record"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_evaluation_result"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_evaluation_result"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_evaluation_result"() TO "service_role";

REVOKE ALL ON TABLE "public"."blind_source_maps" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."blind_source_maps" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."blind_source_maps" TO "service_role";

REVOKE ALL ON TABLE "public"."evaluation_cases" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."evaluation_cases" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."evaluation_cases" TO "service_role";

create view public.webapp_pure_chunks with (security_invoker=true) as
select * from public.srs_knowledge_base
where dataset_source='PURE' and domain='WebApp'
  and metadata->>'kaggle_dataset'='computerscience3/public-requirementspure-dataset'
  and metadata->>'corpus_scope'='webapp-v1';
revoke all on public.webapp_pure_chunks from public, anon, authenticated;
grant select on public.webapp_pure_chunks to service_role;

create or replace function public.match_srs_chunks(
  query_embedding extensions.vector, match_count integer default 8,
  filter_section text default null, filter_domain text default null,
  expected_model text default null, owner_filter uuid default null
) returns table(id bigint, content text, metadata jsonb, similarity double precision)
language plpgsql stable set search_path='' as $$
begin
  if extensions.vector_dims(query_embedding)<>1536 then raise exception 'embedding_dimension_mismatch'; end if;
  if expected_model is not null and exists(select 1 from public.webapp_pure_chunks where owner_filter is null or owner_id=owner_filter)
    and not exists(select 1 from public.webapp_pure_chunks where embedding_model=expected_model and (owner_filter is null or owner_id=owner_filter))
    then raise exception 'embedding_model_mismatch'; end if;
  return query with eligible as materialized (
    select k.* from public.webapp_pure_chunks k
    where (owner_filter is null or k.owner_id=owner_filter)
      and (filter_section is null or k.ieee_section=filter_section)
      and (filter_domain is null or k.domain=filter_domain)
      and (expected_model is null or k.embedding_model=expected_model)
  )
  select k.id,k.content,k.metadata||jsonb_build_object('doc_id',k.doc_id,'dataset_source',k.dataset_source,
    'domain',k.domain,'ieee_section',k.ieee_section,'embedding_model',k.embedding_model),
    1-(k.embedding operator(extensions.<=>) query_embedding)
  from eligible k order by k.embedding operator(extensions.<=>) query_embedding limit greatest(1,least(match_count,20));
end $$;

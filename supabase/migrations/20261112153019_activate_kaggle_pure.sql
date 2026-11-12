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
      and (
        k.metadata->>'kaggle_dataset' = 'computerscience3/public-requirementspure-dataset'
        or not exists (
          select 1 from public.ingestion_runs r
          where r.owner_id = k.owner_id and r.status = 'completed'
            and r.manifest->>'kaggle_dataset' = 'computerscience3/public-requirementspure-dataset'
        )
      )
    order by k.embedding operator(extensions.<=>) query_embedding limit greatest(1,least(match_count,20));
end $function$;

begin;
-- All test data is rolled back. Assertions exercise database behavior, not SQL text.
do $$
declare
  owner_a uuid := gen_random_uuid(); owner_b uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
  r uuid := gen_random_uuid(); sid uuid := gen_random_uuid(); t record;
begin
  if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'TEST: missing RLS'; end if;
  for t in select tablename from pg_tables where schemaname='public' loop
    if has_table_privilege('anon','public.'||t.tablename,'select,insert,update,delete') then raise exception 'TEST: anon privileges on %',t.tablename; end if;
  end loop;
  if has_table_privilege('authenticated','public.integration_secrets','select') then raise exception 'TEST: secrets readable'; end if;
  insert into public.projects(id,owner_id,session_id,title,domain) values(p,owner_a,sid,'Integrity test','Education');
  insert into public.sections(id,owner_id,project_id,section_id,number,title,markdown,status) values
    (s1,owner_a,p,'1.1','1.1','Purpose','original one','drafted'),(s2,owner_a,p,'1.2','1.2','Scope','original two','drafted');
  insert into public.revision_proposals(id,owner_id,project_id,section_id,session_id,before_text,after_text,instruction,base_section_version,status)
    values(r,owner_a,p,s1,sid,'original one','revised one','revise',1,'pending');
  begin
    insert into public.revision_proposals(owner_id,project_id,section_id,session_id,before_text,instruction,base_section_version)
      values(owner_a,p,s1,sid,'original one','second',1);
    raise exception 'TEST: concurrent proposal accepted';
  exception when unique_violation then null; end;
  perform public.accept_revision(owner_a,r);
  if (select markdown from public.sections where id=s1)<>'revised one' then raise exception 'TEST: revision not applied'; end if;
  if (select version from public.sections where id=s2)<>1 or (select markdown from public.sections where id=s2)<>'original two' then raise exception 'TEST: non-target changed'; end if;
  begin
    perform public.save_section(owner_a,p,'1.1',1,'{"markdown":"stale","status":"edited","source":"human"}');
    raise exception 'TEST: stale write accepted';
  exception when raise_exception then if sqlerrm<>'section_changed' then raise; end if; end;
  begin
    perform public.save_section(owner_b,p,'1.1',2,'{"markdown":"intruder","status":"edited","source":"human"}');
    raise exception 'TEST: other owner accepted';
  exception when raise_exception then if sqlerrm<>'not_found' then raise; end if; end;
  update public.sections set locked=true,status='locked',version=version+1 where id=s1;
  begin
    perform public.save_section(owner_a,p,'1.1',3,'{"markdown":"locked mutation","status":"edited","source":"human"}');
    raise exception 'TEST: locked write accepted';
  exception when raise_exception then if sqlerrm<>'section_locked' then raise; end if; end;
  insert into public.ground_truth_docs(doc_id,owner_id,dataset_source,content,language) values('integrity-held-out',owner_a,'dev_seed','Held out','en');
  begin
    insert into public.srs_knowledge_base(owner_id,content,embedding,doc_id,dataset_source,chunk_index,token_count,embedding_model,content_hash)
      values(owner_a,'Leak',array_fill(0.1::real,array[1536])::extensions.vector,'integrity-held-out','dev_seed',0,1,'test-model','integrity-hash');
    raise exception 'TEST: corpus leakage allowed';
  exception when raise_exception then if sqlerrm<>'corpus_leakage' then raise; end if; end;
  insert into public.srs_knowledge_base(owner_id,content,embedding,doc_id,dataset_source,chunk_index,token_count,embedding_model,content_hash)
    values(owner_a,'Retrievable',array_fill(0.1::real,array[1536])::extensions.vector,'integrity-kb','dev_seed',0,1,'test-model','integrity-hash');
  if (select count(*) from public.match_srs_chunks(array_fill(0.1::real,array[1536])::extensions.vector,8,null,null,'test-model'))<>1 then raise exception 'TEST: retrieval failed'; end if;
  begin
    perform public.match_srs_chunks(array_fill(0.1::real,array[1536])::extensions.vector,8,null,null,'wrong-model');
    raise exception 'TEST: model mismatch silent';
  exception when raise_exception then if sqlerrm<>'embedding_model_mismatch' then raise; end if; end;
  -- Actual RLS role test with two owners. Service-only mutations remain ungranted.
  perform set_config('request.jwt.claim.sub',owner_b::text,true);
  set local role authenticated;
  if exists(select 1 from public.projects where id=p) then raise exception 'TEST: owner B sees owner A'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  set local role authenticated;
  if not exists(select 1 from public.projects where id=p) then raise exception 'TEST: owner cannot read own project'; end if;
  reset role;
end $$;
rollback;

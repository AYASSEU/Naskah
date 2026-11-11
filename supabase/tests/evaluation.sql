begin;
set local role service_role;
do $$
declare owner uuid:=gen_random_uuid();project uuid;participant uuid;case_id uuid;assignment uuid;review uuid;value numeric;
begin
 if has_function_privilege('anon','public.calculate_sus_score(jsonb)','execute') or has_function_privilege('authenticated','public.calculate_sus_score(jsonb)','execute') then raise exception 'SUS RPC was exposed';end if;
 select public.calculate_sus_score('[5,1,5,1,5,1,5,1,5,1]') into value;if value<>100 then raise exception 'Wrong SUS score';end if;
 begin perform public.calculate_sus_score(null);raise exception 'NULL answers accepted';exception when others then if sqlerrm<>'invalid_input' then raise;end if;end;
 begin perform public.calculate_sus_score('[3.5,1,5,1,5,1,5,1,5,1]');raise exception 'Fractional answers accepted';exception when others then if sqlerrm<>'invalid_input' then raise;end if;end;
 insert into public.projects(owner_id,title,domain) values(owner,'B8 DB synthetic','Test') returning id into project;
 insert into public.participants(owner_id,code,role,consent,consent_at) values(owner,'B8_DB_'||owner,'expert',true,now()) returning id into participant;
 insert into public.evaluation_cases(owner_id,project_id,title,system_markdown,human_markdown,language,reference_language) values(owner,project,'B8 DB case','Synthetic A','Synthetic B','id','id') returning id into case_id;
 insert into public.blind_assignments(owner_id,participant_id,project_id,case_id,label,source,markdown) values(owner,participant,project,case_id,'A','leak','Synthetic text') returning id into assignment;
 if (select source from public.blind_assignments where id=assignment)<>'blinded' then raise exception 'Source metadata leaked';end if;
 insert into public.blind_source_maps(assignment_id,owner_id,source) values(assignment,owner,'system');
 begin update public.blind_source_maps set source='human' where assignment_id=assignment;raise exception 'Mutable mapping';exception when others then if sqlerrm<>'evaluation_immutable' then raise;end if;end;
 begin insert into public.expert_reviews(owner_id,participant_id,assignment_id,reviewer,label,ratings,justifications) values(owner,participant,assignment,'forged','B','[4,4,4,4]','["one","two","three","four"]');raise exception 'Mismatched label accepted';exception when others then if sqlerrm<>'evaluation_scope_mismatch' then raise;end if;end;
 insert into public.expert_reviews(owner_id,participant_id,assignment_id,reviewer,label,ratings,justifications) values(owner,participant,assignment,'forged','A','[4,4,4,4]','["one","two","three","four"]') returning id into review;
 if (select reviewer from public.expert_reviews where id=review)<>(select code from public.participants where id=participant) then raise exception 'Forged reviewer accepted';end if;
 begin update public.expert_reviews set ratings='[1,1,1,1]' where id=review;raise exception 'Mutable submitted review';exception when others then if sqlerrm<>'evaluation_immutable' then raise;end if;end;
 insert into public.sus_responses(owner_id,participant_id,answers,score,created_at) values(owner,participant,'[5,1,5,1,5,1,5,1,5,1]',-999,'2099-01-01') returning score into value;
 if value<>100 then raise exception 'Forged SUS score retained';end if;
 begin insert into public.sus_responses(owner_id,participant_id,project_id,answers,score) values(owner,participant,project,'[3,3,3,3,3,3,3,3,3,3]',50);raise exception 'Duplicate participant SUS accepted';exception when unique_violation then null;end;
 begin insert into public.sus_responses(owner_id,participant_id,answers,score,is_thesis_run) values(owner,participant,'[3,3,3,3,3,3,3,3,3,3]',50,true);raise exception 'Mixed SUS scope accepted';exception when others then if sqlerrm<>'evaluation_scope_mismatch' then raise;end if;end;
 begin insert into public.rouge_results(owner_id,project_id,case_id,scenario,rouge1,rouge2,rouge_l,language,reference_language,is_thesis_run) values(owner,project,case_id,'B8 synthetic','{}','{}','{}','id','id',true);raise exception 'Mock research ROUGE accepted';exception when others then if sqlerrm<>'dev_seed_excluded' then raise;end if;end;
 begin insert into public.statistical_results(owner_id,result,is_thesis_run) values(owner,'{"kind":"statistics","data_scope":"dev"}',true);raise exception 'Mixed statistics scope accepted';exception when others then if sqlerrm<>'evaluation_scope_mismatch' then raise;end if;end;
end $$;
rollback;

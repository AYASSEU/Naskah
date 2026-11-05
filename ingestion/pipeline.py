import argparse
import hashlib
import json
import math
import os
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from .io import ROOT, Database, load_env, read_jsonl, read_embedding_cache, write_json, write_jsonl, request
from .chunking import assign_split, chunk_document
from .sources import fetch_sources
from .envelope import unseal


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def embedding_config(use_app_settings):
    if use_app_settings:
        db = Database()
        rows = db.call(f'integration_secrets?owner_id=eq.{db.owner}&provider=eq.embeddings&select=*')
        if not rows:
            raise ValueError('embedding_connection_missing; enter it in Settings')
        row = rows[0]
        key = unseal(row,'embeddings',db.owner,{int(os.environ.get('APP_KEY_VERSION','1')):os.environ['APP_ENCRYPTION_KEY']})
        config = row['config']
    else:
        key = os.environ.get('EMBEDDING_API_KEY')
        config = {'baseUrl':os.environ.get('EMBEDDING_BASE_URL','https://api.openai.com/v1'),
                  'model':os.environ.get('EMBEDDING_MODEL','text-embedding-3-small'),
                  'dimensions':int(os.environ.get('EMBEDDING_DIMENSIONS','1536'))}
    if not key:
        raise ValueError('embedding_key_missing; use --use-app-settings')
    if config['dimensions'] != 1536:
        raise ValueError('embedding_dimension_mismatch')
    parsed = urlsplit(config['baseUrl'])
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('invalid_provider_url')
    local = parsed.hostname in ('localhost','127.0.0.1','::1','host.docker.internal')
    if parsed.scheme != 'https' and not (local and os.environ.get('ALLOW_LOCAL_PROVIDER_URLS') == 'true'):
        raise ValueError('invalid_provider_url')
    if parsed.hostname == 'host.docker.internal':
        config = {**config,'baseUrl':urlunsplit((parsed.scheme,f'localhost:{parsed.port}',parsed.path,'',''))}
    return config, key


def embed_batch(config,key,texts):
    response = request(config['baseUrl'].rstrip('/')+'/embeddings','POST',
                       {'model':config['model'],'dimensions':config['dimensions'],'input':texts},
                       {'Authorization':f'Bearer {key}'})
    if response.get('model') and response['model'] != config['model']:
        raise ValueError('embedding_model_mismatch')
    vectors = sorted(response.get('data',[]),key=lambda item:item.get('index',-1))
    if len(vectors) != len(texts) or [v.get('index') for v in vectors] != list(range(len(texts))):
        raise ValueError('embedding_batch_mismatch')
    for value in vectors:
        vector = value.get('embedding')
        if not isinstance(vector,list) or len(vector)!=1536 or not all(isinstance(x,(int,float)) and math.isfinite(x) for x in vector) or not any(vector):
            raise ValueError('embedding_dimension_mismatch')
    return [value['embedding'] for value in vectors]


def fetch(args):
    docs,issues = fetch_sources(args.data,args.output,args.datasets.split(','))
    write_jsonl(args.output/'documents.jsonl',docs)
    print(json.dumps({'documents':len(docs),'source_issues':len(issues),'manifest':str(args.output/'fetch_manifest.json')}))


def split(args):
    docs = read_jsonl(args.output/'documents.jsonl')
    ids = [d['doc_id'] for d in docs]
    if len(set(ids))!=len(ids):
        raise ValueError('duplicate_document_ids')
    splits = assign_split(docs,args.seed)
    manifest = {'seed':args.seed,'algorithm':'per-dataset sorted sha256(seed:doc_id), round(20%) held out; dev_seed excluded from research splits',
                'documents_digest':digest(docs),'assignments':splits}
    existing = args.output/'split_manifest.json'
    if existing.exists() and json.loads(existing.read_text()) != manifest:
        raise ValueError('split_changed; choose a new output directory instead of overwriting provenance')
    write_json(existing,manifest)
    held = [d for d in docs if splits[d['doc_id']]=='ground_truth']
    write_jsonl(args.output/'kb_documents.jsonl',[d for d in docs if splits[d['doc_id']]=='kb'])
    write_jsonl(args.output/'ground_truth.jsonl',held)
    db = Database()
    for offset in range(0,len(held),20):
        db.call('ground_truth_docs?on_conflict=doc_id','POST',[
            {'doc_id':d['doc_id'],'owner_id':db.owner,'dataset_source':d['dataset_source'],'language':d['language'],
             'content':d['content'],'metadata':{**d.get('metadata',{}),'split_seed':args.seed,'split_manifest_digest':digest(manifest)}} for d in held[offset:offset+20]],'resolution=merge-duplicates,return=minimal')
    print(json.dumps({'kb_documents':len(docs)-len(held),'held_out_documents':len(held)}))


def chunk(args):
    documents = read_jsonl(args.output/'kb_documents.jsonl')
    chunks,issues = [],[]
    for doc in documents:
        try:
            chunks.extend(chunk_document(doc))
        except ValueError as error:
            issues.append({'doc_id':doc['doc_id'],'reason':str(error)})
    unique = {}
    for row in chunks:
        unique.setdefault(row['content_hash'],row)
    write_jsonl(args.output/'chunks.jsonl',unique.values())
    write_json(args.output/'chunk_report.json',{'input_chunks':len(chunks),'unique_chunks':len(unique),'duplicates_removed':len(chunks)-len(unique),'issues':issues})
    print(json.dumps({'chunks':len(unique),'duplicates_removed':len(chunks)-len(unique),'review_required':len(issues)}))
    if issues:
        raise ValueError('chunk_review_required; inspect chunk_report.json before embedding')


def embed(args):
    config,key = embedding_config(args.use_app_settings)
    if args.require_mock and urlsplit(config['baseUrl']).hostname not in ('localhost','127.0.0.1','::1'):
        raise ValueError('test_requires_local_mock_provider')
    chunks = read_jsonl(args.output/'chunks.jsonl')
    report = json.loads((args.output/'chunk_report.json').read_text())
    if report['issues']:
        raise ValueError('chunk_review_required')
    db = Database()
    cache_path = args.output/'embeddings.jsonl'
    cache = read_embedding_cache(cache_path)
    if any(r['embedding_model']!=config['model'] or r['dimensions']!=1536 for r in cache):
        raise ValueError('embedding_model_mismatch; use a new output directory to reindex')
    done = {r['content_hash'] for r in cache}
    remaining = [r for r in chunks if r['content_hash'] not in done]
    run_path = args.output/'run.json'
    run = json.loads(run_path.read_text()) if run_path.exists() else {'id':str(uuid.uuid4()),'started_at':now(),'chunks_digest':digest(chunks)}
    if run['chunks_digest'] != digest(chunks):
        raise ValueError('resume_content_changed')
    write_json(run_path,run)
    source = ','.join(sorted(set(c['dataset_source'] for c in chunks)))
    manifest = json.loads((args.output/'fetch_manifest.json').read_text())
    db.call('ingestion_runs?on_conflict=id','POST',{'id':run['id'],'owner_id':db.owner,'dataset_source':source,
        'manifest':manifest,'embedding_model':config['model'],'dimensions':1536,'status':'embedding','counts':{'chunks':len(chunks),'cached':len(done)}},'resolution=merge-duplicates,return=minimal')
    try:
        for offset in range(0,len(remaining),32):
            batch = remaining[offset:offset+32]
            vectors = embed_batch(config,key,[row['content'] for row in batch])
            with cache_path.open('a',encoding='utf-8') as handle:
                for row,vector in zip(batch,vectors):
                    handle.write(json.dumps({'content_hash':row['content_hash'],'embedding_model':config['model'],'dimensions':1536,'embedding':vector})+'\n')
                handle.flush();os.fsync(handle.fileno())
        print(json.dumps({'embedded':len(remaining),'reused':len(chunks)-len(remaining),'model':config['model'],'dimensions':1536}))
    except Exception:
        db.call(f'ingestion_runs?id=eq.{run["id"]}','PATCH',{'status':'failed','finished_at':now()})
        raise


def load(args):
    db = Database()
    chunks = read_jsonl(args.output/'chunks.jsonl')
    embeddings = {r['content_hash']:r for r in read_jsonl(args.output/'embeddings.jsonl')}
    run = json.loads((args.output/'run.json').read_text())
    for offset in range(0,len(chunks),20):
        rows = []
        for chunk in chunks[offset:offset+20]:
            vector = embeddings.get(chunk['content_hash'])
            if not vector:
                raise ValueError('embedding_incomplete')
            rows.append({**chunk,**vector,'owner_id':db.owner,'ingestion_run_id':run['id']})
        db.call('srs_knowledge_base?on_conflict=content_hash','POST',rows,'resolution=merge-duplicates,return=minimal')
    tokens = sum(c['token_count'] for c in chunks)
    price = os.environ.get('EMBEDDING_USD_PER_MILLION_TOKENS')
    cost = tokens*float(price)/1000000 if price else (0 if args.require_mock else None)
    db.call(f'ingestion_runs?id=eq.{run["id"]}','PATCH',{'status':'completed','finished_at':now(),
        'counts':{'chunks':len(chunks),'estimated_tokens':tokens},'cost_estimate':cost})
    print(json.dumps({'loaded':len(chunks),'estimated_cost_usd':cost,'cost_note':'approximate; provider billing is authoritative'}))


def verify(args):
    db = Database()
    chunks = db.rows('srs_knowledge_base','id,doc_id,dataset_source,ieee_section,token_count,content_hash,embedding_model,dimensions,metadata')
    held = db.rows('ground_truth_docs','doc_id')
    if not chunks:
        raise ValueError('knowledge_base_empty')
    if set(r['doc_id'] for r in chunks)&set(r['doc_id'] for r in held):
        raise ValueError('corpus_leakage')
    if len(set(r['content_hash'] for r in chunks))!=len(chunks):
        raise ValueError('duplicate_chunks')
    if any(r['token_count']>600 or (r['token_count']<300 and not r['metadata'].get('tail')) for r in chunks):
        raise ValueError('token_length_violation')
    config,key = embedding_config(args.use_app_settings)
    if any(r['embedding_model']!=config['model'] or r['dimensions']!=1536 for r in chunks):
        raise ValueError('embedding_model_mismatch')
    checked = []
    for section,query in [('security','security authorization audit unauthorized access'),('specific_requirements','functional requirements validation input process output')]:
        if not any(r['ieee_section']==section for r in chunks):
            continue
        vector = embed_batch(config,key,[query])[0]
        result = db.call('rpc/match_srs_chunks','POST',{'query_embedding':vector,'match_count':5,'filter_section':section,'expected_model':config['model']})
        if not result or any(r['metadata']['ieee_section']!=section for r in result):
            raise ValueError('retrieval_sanity_failed')
        checked.append(section)
    report = {'counts_by_dataset':dict(Counter(r['dataset_source'] for r in chunks)),
              'counts_by_section':dict(Counter(r['ieee_section'] for r in chunks)),
              'token_range':[min(r['token_count'] for r in chunks),max(r['token_count'] for r in chunks)],
              'duplicate_rate':0,'leakage':False,'retrieval_checks':checked,'model':config['model'],'dimensions':1536}
    write_json(args.output/'verification.json',report);print(json.dumps(report))


def main():
    parser = argparse.ArgumentParser(description='Naskah reproducible corpus pipeline')
    parser.add_argument('command',choices=['fetch','split','chunk','embed','load','verify','all'])
    parser.add_argument('--datasets',default='dev_seed')
    parser.add_argument('--data',type=Path,default=ROOT/'ingestion/data')
    parser.add_argument('--output',type=Path,default=ROOT/'ingestion/output/dev')
    parser.add_argument('--seed',default='naskah-thesis-v1')
    parser.add_argument('--use-app-settings',action='store_true')
    parser.add_argument('--require-mock',action='store_true',help='Fail instead of sending automated test data to a remote embedding provider')
    args = parser.parse_args();args.output.mkdir(parents=True,exist_ok=True);load_env()
    try:
        commands = ['fetch','split','chunk','embed','load','verify'] if args.command=='all' else [args.command]
        for command in commands:
            globals()[command](args)
    except (ValueError,RuntimeError,KeyError,OSError) as error:
        # Exceptions from network libraries may contain headers; only our stable messages escape.
        message = str(error) if isinstance(error,(ValueError,RuntimeError)) else type(error).__name__
        print(f'Ingestion stopped: {message}',file=sys.stderr);sys.exit(1)

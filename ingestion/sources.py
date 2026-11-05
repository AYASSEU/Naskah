import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from xml.etree import ElementTree
from .io import write_json

PURE = 'https://zenodo.org/records/7118517'
PROMISE = 'https://raw.githubusercontent.com/AleksandarMitrevski/se-requirements-classification/master/0-datasets/PROMISE_exp/PROMISE_exp.arff'


def download(url, path, maximum=64 * 1024 * 1024):
    path.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=45) as response:
        data = response.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError('download_too_large')
    path.write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def extract_zip(path, destination):
    destination = destination.resolve()
    with zipfile.ZipFile(path) as archive:
        total = 0
        for item in archive.infolist():
            target = (destination / item.filename).resolve()
            if not target.is_relative_to(destination) or item.file_size > 64 * 1024 * 1024:
                raise ValueError('unsafe_archive')
            total += item.file_size
            if total > 256 * 1024 * 1024:
                raise ValueError('archive_too_large')
            if item.is_dir():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))


def xml_text(data):
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('xml_entities_not_allowed')
    root = ElementTree.fromstring(data)
    return '\n'.join(e.text.strip() for e in root.iter() if len(e) == 0 and e.text and e.text.strip())


def parse_file(path):
    if path.suffix.lower() in ('.txt', '.md'):
        return path.read_text(encoding='utf-8-sig')
    if path.suffix.lower() == '.xml':
        return xml_text(path.read_bytes())
    if path.suffix.lower() == '.docx':
        with zipfile.ZipFile(path) as archive:
            return xml_text(archive.read('word/document.xml'))
    if path.suffix.lower() == '.pdf':
        from pypdf import PdfReader
        return '\n\n'.join(page.extract_text() or '' for page in PdfReader(path).pages)
    raise ValueError('unsupported_format')


def promise_documents(path):
    projects = {}
    in_data = False
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if line.lower().strip() == '@data':
            in_data = True
        elif in_data and line.strip() and not line.startswith('%'):
            match = re.match(r"^([^,]+),['\"](.*)['\"],([^,]+)$", line.strip())
            if not match:
                raise ValueError('promise_row_invalid')
            project, requirement, label = match.groups()
            projects.setdefault(project, []).append((requirement, label))
    result = []
    for project, rows in projects.items():
        result.append(dict(doc_id=f'PROMISE_exp:project:{project}',dataset_source='PROMISE_exp',language='en',
                           content='\n'.join(f'REQ-{i+1:03} [{label}]: {text}' for i,(text,label) in enumerate(rows)),
                           ieee_section='specific_requirements',chunk_type='labeled_requirements',
                           metadata={'source_url':PROMISE,'license':'CC-BY-SA-3.0','project_id':project,
                                     'labels':sorted(set(label for _,label in rows)),'version':hashlib.sha256(path.read_bytes()).hexdigest()}))
    return result


def fetch_sources(data_dir, output_dir, sources):
    from .dev_seed import documents as dev_documents
    rows, manifest, issues = [], [], []
    for source in sources:
        folder = data_dir / 'drop' / source
        folder.mkdir(parents=True, exist_ok=True)
        if source == 'dev_seed':
            rows.extend(dev_documents());manifest.append({'dataset':'dev_seed','license':'CC0-1.0','synthetic':True,'source_url':'local:ingestion/dev_seed.py'});continue
        if source == 'PURE':
            try:
                metadata = json.loads(urlopen('https://zenodo.org/api/records/7118517', timeout=30).read())
                license_id = metadata['metadata']['license']['id']
                if license_id != 'cc-by-4.0':
                    raise ValueError('source_terms_changed_review_required')
                for file in metadata['files']:
                    if not file['key'].endswith('.zip'):
                        continue
                    target = data_dir / 'downloads' / file['key']
                    checksum = download(file['links']['self'], target)
                    actual = 'md5:' + hashlib.md5(target.read_bytes()).hexdigest()
                    if actual != file['checksum']:
                        raise ValueError('source_checksum_mismatch')
                    manifest.append({'dataset':source,'source_url':file['links']['self'],'version':'7118517','license':license_id,'sha256':checksum})
                    extract_zip(target,folder)
            except Exception as error:
                issues.append({'dataset':source,'status':'manual_download_required','reason':type(error).__name__,'url':PURE})
            files = [p for p in folder.rglob('*') if p.is_file() and not p.name.startswith('.') and '__MACOSX' not in p.parts]
            # Prefer XML when a document also has a PDF representation.
            seen = set()
            for path in sorted(files,key=lambda p:(p.suffix.lower()!='.xml',str(p))):
                canonical = re.sub(r'[^a-z0-9]','',path.stem.lower())
                if canonical in seen:
                    continue
                try:
                    content = parse_file(path)
                    if not content.strip():
                        raise ValueError('no_text_layer')
                    seen.add(canonical)
                    rows.append(dict(doc_id=f'PURE:{canonical}',dataset_source='PURE',language='en',content=content,
                                     metadata={'source_url':PURE,'license':'CC-BY-4.0','filename':path.name,'version':'7118517','sha256':hashlib.sha256(path.read_bytes()).hexdigest()}))
                except Exception as error:
                    issues.append({'dataset':source,'file':path.name,'status':'review_extraction','reason':str(error) if isinstance(error,ValueError) else type(error).__name__})
        elif source == 'PROMISE_exp':
            path = folder / 'PROMISE_exp.arff'
            try:
                checksum = download(PROMISE,path)
                if 'Creative Commons Attribution-Share Alike 3.0' not in path.read_text(encoding='utf-8'):
                    raise ValueError('source_terms_changed_review_required')
                manifest.append({'dataset':source,'source_url':PROMISE,'license':'CC-BY-SA-3.0','sha256':checksum,'attribution':'Jane Cleland-Huang; expanded PROMISE by Lima et al. (2019)'})
                rows.extend(promise_documents(path))
            except Exception as error:
                issues.append({'dataset':source,'status':'manual_download_required','reason':type(error).__name__,'url':PROMISE})
        elif source == 'Kaggle':
            # A guessed dataset slug would create false provenance. Require verified source metadata.
            sidecar = folder / 'source.json'
            if not sidecar.exists():
                discovery = 'https://www.kaggle.com/api/v1/datasets/list?search=fault-prone%20srs'
                try:
                    candidates = json.loads(urlopen(discovery,timeout=20).read())
                    result = {'candidates':[{k:r.get(k) for k in ['ref','title','licenseName','lastUpdated']} for r in candidates] if isinstance(candidates,list) else [],'discovery':'responded'}
                    exact = next((r for r in candidates if r.get('ref')=='corpus4panwo/fault-prone-srs-dataset'),None)
                    if exact:
                        result['source_url']='https://www.kaggle.com/datasets/'+exact['ref']
                        try:
                            result['sha256']=download('https://www.kaggle.com/api/v1/datasets/download/'+exact['ref'],data_dir/'downloads/fault-prone-srs-dataset.zip')
                            result['download']='downloaded; not ingested pending terms review'
                        except Exception as error:
                            result['download']=type(error).__name__
                except Exception as error:
                    result = {'discovery':type(error).__name__}
                issues.append({'dataset':source,'status':'identity_and_terms_unverified','discovery_url':discovery,**result,'candidate':'https://github.com/ftnrjnnh-m/Fault-proneSRSDataset','note':'No exact Kaggle record verified; see docs/research-notes.md.'})
                continue
            metadata = json.loads(sidecar.read_text(encoding='utf-8'))
            if not metadata.get('verified_by_author') or not metadata.get('license') or not metadata.get('source_url','').startswith('https://www.kaggle.com/datasets/'):
                raise ValueError('kaggle_source_metadata_incomplete')
            manifest.append({'dataset':source,**metadata})
            for path in folder.glob('*.jsonl'):
                from .io import read_jsonl
                for doc in read_jsonl(path):
                    if not all(doc.get(k) for k in ['doc_id','content','language','project_id']):
                        raise ValueError('kaggle_document_requires_project_group')
                    rows.append({**doc,'doc_id':f'Kaggle:{doc["project_id"]}','dataset_source':'Kaggle','metadata':metadata})
        else:
            raise ValueError('unknown_dataset')
    # Concatenate requirement rows from a single project before splitting.
    grouped = {}
    for row in rows:
        if row['doc_id'] in grouped:
            grouped[row['doc_id']]['content'] += '\n' + row['content']
        else:
            grouped[row['doc_id']] = row
    write_json(output_dir / 'fetch_manifest.json',{'fetched_at':datetime.now(timezone.utc).isoformat(),'sources':manifest,'issues':issues})
    return list(grouped.values()), issues

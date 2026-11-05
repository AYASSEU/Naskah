# Reproducible corpus ingestion

Run from the repository root with Python 3.12+. The CLI reads ignored `apps/web/.env.local` without printing secrets. Start local Supabase first.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r ingestion/requirements.txt
.venv\Scripts\python.exe -m unittest ingestion.test_pipeline ingestion.test_envelope
.venv\Scripts\python.exe -m ingestion all --use-app-settings --require-mock
```

The last command creates 150 synthetic chunks across five domains, decrypts the embedding connection saved in Settings, calls the local mock provider and verifies database retrieval. Never use development rows as thesis evidence. `--require-mock` refuses remote providers.

Stages: `fetch`, `split`, `chunk`, `embed`, `load`, `verify`, `all`. Defaults: `--datasets dev_seed`, `--output ingestion/output/dev`, `--seed naskah-thesis-v1`. Changing a split or document content requires a new output directory. Content hashes prevent duplicate loads; embeddings resume from a cache, recovering an incomplete final append. HTTP 429 respects Retry-After with bounded retries. Keys can alternatively come from `EMBEDDING_API_KEY`, with `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`.

## Research sources

```powershell
.venv\Scripts\python.exe -m ingestion fetch --datasets PURE,PROMISE_exp,Kaggle --output ingestion/output/research
.venv\Scripts\python.exe -m ingestion split --output ingestion/output/research
.venv\Scripts\python.exe -m ingestion chunk --output ingestion/output/research
```

Inspect fetch/split manifests and `chunk_report.json` before embedding. PROMISE requirements are grouped by project. Held-out content goes only into `ground_truth_docs`. Oversize indivisible statements fail chunking rather than being truncated. After review, run `embed`, `load`, `verify` with the same output directory and `--use-app-settings`; these can incur charges on a real provider unless `--require-mock` is supplied.

PURE ZIPs are verified against Zenodo MD5 and recorded with SHA-256, version, URL and license. XML is preferred over same-name PDF; TXT/XML/PDF/DOCX extraction is supported. Legacy `.doc` requires conversion and source review; scanned PDF requires OCR. Gaps remain in the manifest.

Manual drop locations: `ingestion/data/drop/PURE/`, `ingestion/data/drop/PROMISE_exp/PROMISE_exp.arff`, and `ingestion/data/drop/Kaggle/`.

Kaggle discovery identifies `corpus4panwo/fault-prone-srs-dataset`, but publisher metadata says its license is Unknown. Its automatic download is recorded without importing it for research. Confirm terms and suitability first. The manual alternative is `kaggle datasets download -d corpus4panwo/fault-prone-srs-dataset -p ingestion/data/drop/Kaggle`. Normalize into `documents.jsonl` with `doc_id`, `project_id`, `language`, `content`. Rows sharing a project are grouped before splitting. Add `source.json` containing the exact Kaggle `source_url`, verified `license`, `version`, and `verified_by_author: true` only after actual author review. Raw and derived corpora remain outside Git.

## Reproducibility limits

Tokens use `ceil(character_count / 4)`, an approximation, not billing tokens. Target 450, range 300–600, short final chunks allowed. Unknown headings remain `unknown`; confidence is recorded. Whole-statement overlap is capped at 15%, approximating 12.5%; it may fall below 10% when a complete statement would exceed the cap. Requirements are never split to meet overlap targets.

Verification paginates all rows and checks duplicate hashes, document leakage, model/dimensions, token bounds, counts and section-filtered retrieval. Cost is zero only for mock tests, otherwise unknown unless `EMBEDDING_USD_PER_MILLION_TOKENS` is set. Provider billing is authoritative.

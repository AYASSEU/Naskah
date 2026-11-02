# Phase 2 offline ingestion
Split PURE, PROMISE_exp and the selected Kaggle corpus 80:20 at document level
before preprocessing. Never retrieve held-out evaluation documents. Clean text,
chunk by heading at 300–600 tokens, preserve source IDs, section, dataset, split,
and transformation version. Generate embeddings and verify the selected model's
dimension matches SQL. Load training chunks into the pgvector HNSW cosine index.
Keep test source IDs in a reproducible manifest. This folder runs nothing yet.

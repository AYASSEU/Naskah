# Research validity

- Indonesian generated documents and English references must not be compared as if ROUGE were language independent. Default output_language is id. The author and supervisor must choose a matched evaluation language; an override records a limitation, not a valid cross-language score.
- Development corpus and mock provider outputs are synthetic. dataset_source=dev_seed and is_thesis_run=false must propagate into retrieval logs, generation logs and evaluation exports. They cannot be included in thesis aggregate results.
- Split by source document/project before chunking. A source identifier must never appear in both ground_truth_docs and srs_knowledge_base. PROMISE requirements are grouped by originating project, not split row by row.
- Store dataset URL, version/date, terms, checksum, split seed, chunker version, embedding model/dimension, generation model returned by provider, prompt version, K and token usage for reproducibility.
- Numeric targets absent from the input and retrieved evidence are assumptions. A clearer sentence is not evidence of a grounded requirement. Keep needs_confirmation visible and unresolved until the author confirms it.
- Blind document-to-source assignments are server records. Do not expose them before review submission. Participant codes are pseudonymous; research forms require recorded consent.
- PURE candidate: https://zenodo.org/records/7118517. The Kaggle title in the brief is not sufficient to establish a unique verified dataset; do not substitute unrelated fault-prediction datasets.

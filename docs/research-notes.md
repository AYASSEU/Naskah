# Research validity

- Indonesian generated documents and English references must not be compared as if ROUGE were language independent. Default output_language is id. The author and supervisor must choose a matched evaluation language; an override records a limitation, not a valid cross-language score.
- Development corpus and mock provider outputs are synthetic. dataset_source=dev_seed and is_thesis_run=false must propagate into retrieval logs, generation logs and evaluation exports. They cannot be included in thesis aggregate results.
- Split by source document/project before chunking. A source identifier must never appear in both ground_truth_docs and srs_knowledge_base. PROMISE requirements are grouped by originating project, not split row by row.
- Store dataset URL, version/date, terms, checksum, split seed, chunker version, embedding model/dimension, generation model returned by provider, prompt version, K and token usage for reproducibility.
- Numeric targets absent from the input and retrieved evidence are assumptions. A clearer sentence is not evidence of a grounded requirement. Keep needs_confirmation visible and unresolved until the author confirms it.
- Blind document-to-source assignments are server records. Do not expose them before review submission. Participant codes are pseudonymous; research forms require recorded consent.
- PURE candidate: https://zenodo.org/records/7118517. The Kaggle title in the brief is not sufficient to establish a unique verified dataset; do not substitute unrelated fault-prediction datasets.
# Corpus preparation observed on 2026-11-05

The [PURE v7118517 record](https://zenodo.org/records/7118517) identifies CC BY 4.0. Both ZIPs downloaded and matched the publisher MD5 checksums; local manifests also record SHA-256. The [PROMISE_exp source](https://github.com/AleksandarMitrevski/se-requirements-classification/blob/master/0-datasets/PROMISE_exp/PROMISE_exp.arff) contains its CC BY-SA 3.0 notice and attribution instructions. Derived files remain local and retain that provenance. Do not infer licenses for other corpora from these sources.

Extraction produced 65 PURE document representations and 47 PROMISE project groups. The deterministic preliminary split has 90 retrieval documents and 22 held-out documents. Chunking found 16 documents with statements over the size cap and stopped before embedding research material. The fetch manifest also lists 16 extraction/format gaps. Review legacy Word files, scanned/ambiguous extraction, and alternate document versions (notably EIRENE and PEPPOL) before freezing a thesis split. These counts describe a preliminary engineering import, not a validated experimental corpus.

Kaggle's public discovery API identified [corpus4panwo/fault-prone-srs-dataset](https://www.kaggle.com/datasets/corpus4panwo/fault-prone-srs-dataset), last updated 2023-06-21, with license recorded as Unknown. This resolves the previously unverified URL but does not establish research reuse terms. The automatic download result is recorded separately; importing it requires author verification of terms and project grouping. The similarly named GitHub collection has not been substituted.

Development verification used 150 synthetic chunks and deterministic mock embeddings. All 150 were reused on a second run; there were no duplicate hashes or held-out document IDs in retrieval. This is an implementation check only. Real research documents have not been embedded or used to generate thesis metrics.


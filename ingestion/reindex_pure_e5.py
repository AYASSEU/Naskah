"""Reindex the existing Kaggle PURE snapshot through the local E5 service."""
from datetime import datetime, timezone
import os
import uuid
from pathlib import Path

from ingestion.io import Database, load_env, request

MODEL = "multilingual-e5-small-614241f6-pad1536"
SOURCE = "computerscience3/public-requirementspure-dataset"
URL = "http://127.0.0.1:4011/v1/embeddings"


def main():
    load_env()
    db = Database()
    rows = [r for r in db.rows("srs_knowledge_base", "id,doc_id,content,content_hash,metadata,chunk_index,token_count,ieee_section,dataset_source")
            if r["metadata"].get("kaggle_dataset") == SOURCE]
    if not rows:
        raise RuntimeError("PURE index missing")
    runtime = Path(os.environ["LOCALAPPDATA"]) / "naskah-runtime"
    token = (runtime / "e5.env").read_text().strip().split("=", 1)[1]
    headers = {"Authorization": "Bearer " + token}
    run = str(uuid.uuid4())
    for start in range(0, len(rows), 8):
        batch = rows[start:start+8]
        result = request(URL, "POST", {"model": MODEL, "input_type": "passage",
                         "input": [r["content"] for r in batch]}, headers)
        if result["model"] != MODEL or len(result["data"]) != len(batch):
            raise ValueError("incomplete batch")
        for i, (item, row) in enumerate(zip(result["data"], batch)):
            vector = item["embedding"]
            if item["index"] != i or len(vector) != 1536 or abs(sum(v*v for v in vector)-1) > 0.001:
                raise ValueError("invalid E5 embedding")
            row.update(embedding=vector, embedding_model=MODEL, owner_id=db.owner, ingestion_run_id=run)
            row["metadata"]["embedding_provider"] = MODEL
        if start % 80 == 0:
            print("Encoded", start+len(batch), "/", len(rows), flush=True)
    manifest = dict(rows[0]["metadata"], kaggle_dataset=SOURCE, embedding_model=MODEL,
                    model_revision="614241f622f53c4eeff9890bdc4f31cfecc418b3",
                    passage_prefix="passage: ", query_prefix="query: ", native_dimensions=384)
    manifest.pop("row_ids", None)
    db.call("ingestion_runs", "POST", dict(id=run, owner_id=db.owner, dataset_source="PURE",
            manifest=manifest, embedding_model=MODEL, dimensions=1536, status="embedding"))
    # A single PostgREST statement keeps row IDs and switches every vector together.
    db.call("srs_knowledge_base?on_conflict=content_hash", "POST", rows,
            "resolution=merge-duplicates,return=minimal")
    db.call("ingestion_runs?id=eq."+run, "PATCH", dict(status="completed", finished_at=datetime.now(timezone.utc).isoformat(), counts={"chunks":len(rows)}))
    query = request(URL, "POST", {"model":MODEL, "input":"Bagaimana sistem mencatat akses ke rekam medis pasien?"}, headers)
    hits = db.call("rpc/match_srs_chunks","POST",dict(query_embedding=query["data"][0]["embedding"],
                   expected_model=MODEL, owner_filter=db.owner, match_count=3))
    assert len(hits)==3 and all(h["metadata"].get("kaggle_dataset")==SOURCE for h in hits)
    for hit in hits:
        print(round(hit["similarity"],3), hit["content"][:150])


if __name__ == "__main__":
    main()

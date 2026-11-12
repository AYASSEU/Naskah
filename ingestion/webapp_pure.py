"""Index reviewed, individual WebApp requirements from the Kaggle PURE KB split."""
import csv
import hashlib
import io
import json
import os
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from .io import Database, load_env, request
from .kaggle_pure import ARCHIVE, OUTPUT, SOURCE
from .reindex_pure_e5 import MODEL, URL

# Explicit source rows, reviewed for browser-delivered behaviour. Never import
# adjacent sentences from the mixed promisedataALL or EHR documents.
REVIEWED = {
    "promisedataALL": {96,365,462,463,464,466,469,470,471,478,480,481,488,495,496,
                       498,499,503,505,516,524,525,527,538,540,541,542,544,545,
                       546,547,550,551,555,653,759},
    "EMR-RFP12-009-ITS-CombinedRequirements": {383,386,521,1686},
    "LACountyEHR_Requirements": {1007},
}


def main():
    load_env()
    db = Database()
    assignments = json.loads((OUTPUT / "split_manifest.json").read_text())["assignments"]
    checksum = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    original = json.loads((OUTPUT / "fetch_manifest.json").read_text())
    if checksum != original["sha256"]:
        raise ValueError("Unexpected source archive")
    token = (Path(os.environ["LOCALAPPDATA"]) / "naskah-runtime/e5.env").read_text().strip().split("=", 1)[1]
    rows = []
    with zipfile.ZipFile(ARCHIVE) as archive:
        with archive.open("Pure_Annotate_Dataset.csv") as raw:
            for row in csv.DictReader(io.TextIOWrapper(raw, encoding="latin1", newline="")):
                name, number = row["id"].rsplit(" - parsed.json_", 1) if " - parsed.json_" in row["id"] else ("", "0")
                if name not in REVIEWED or int(number) not in REVIEWED[name]:
                    continue
                doc = "KagglePURE:" + name + " - parsed.json"
                if assignments.get(doc) != "kb":
                    raise ValueError("Selected row outside KB split")
                text = " ".join(row["sentence"].split())
                try:
                    text = text.encode("latin1").decode("utf8")
                except UnicodeDecodeError:
                    pass
                rows.append(dict(owner_id=db.owner, doc_id=doc, dataset_source="PURE",
                    domain="WebApp", ieee_section="security" if row["security"]=="1" else "specific_requirements",
                    chunk_index=int(number), content=text, content_hash=hashlib.sha256(text.encode()).hexdigest(),
                    embedding_model=MODEL, token_count=(len(text)+3)//4, metadata=dict(
                        kaggle_dataset=SOURCE, corpus_scope="webapp-v1", row_ids=[number],
                        language="en", sha256=checksum, tail=True, embedding_provider=MODEL)))
    if len(rows) != sum(map(len, REVIEWED.values())):
        raise ValueError("Reviewed source row missing")
    for start in range(0, len(rows), 8):
        batch = rows[start:start+8]
        result = request(URL, "POST", dict(model=MODEL, input_type="passage",
            input=[r["content"] for r in batch]), {"Authorization": "Bearer "+token})
        for r, item in zip(batch, result["data"], strict=True):
            r["embedding"] = item["embedding"]
    run = str(uuid.uuid4())
    db.call("ingestion_runs","POST",dict(id=run, owner_id=db.owner, dataset_source="PURE",
        embedding_model=MODEL,dimensions=1536,status="embedding",manifest=dict(original, corpus_scope="webapp-v1")))
    for row in rows:
        row["ingestion_run_id"] = run
    db.call("srs_knowledge_base?on_conflict=content_hash","POST",rows,"resolution=merge-duplicates,return=minimal")
    db.call("ingestion_runs?id=eq."+run,"PATCH",dict(status="completed",
        finished_at=datetime.now(timezone.utc).isoformat(),counts={"webapp_requirements":len(rows)}))
    print("Indexed reviewed WebApp requirements:",len(rows))


if __name__=="__main__":
    main()

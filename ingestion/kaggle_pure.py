"""Prepare the pinned Kaggle PURE CSV for the local SRequeS corpus."""
import csv
import hashlib
import io
import re
import textwrap
import zipfile
from collections import defaultdict
from pathlib import Path

from .chunking import token_count
from .io import ROOT, read_jsonl, write_json, write_jsonl

SOURCE = "computerscience3/public-requirementspure-dataset"
ARCHIVE = ROOT / "ingestion/data/drop/KagglePURE/pure.zip"
OUTPUT = ROOT / "ingestion/output/kaggle-pure-v1"


def prepare():
    checksum = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    groups = defaultdict(list)
    with zipfile.ZipFile(ARCHIVE) as archive:
        with archive.open("Pure_Annotate_Dataset.csv") as raw:
            for row in csv.DictReader(io.TextIOWrapper(raw, encoding="latin-1", newline="")):
                group, index = row["id"].rsplit("_", 1)
                sentence = " ".join(row["sentence"].split())
                if not sentence:
                    raise ValueError("empty requirement")
                groups[group].append((index, sentence, row["security"] == "1"))
    metadata = dict(kaggle_dataset=SOURCE, version=1, sha256=checksum,
                    license="Unknown")
    documents = [
        dict(doc_id="KagglePURE:" + name, dataset_source="PURE", language="en",
             content="\n".join(row[1] for row in rows), metadata=metadata)
        for name, rows in groups.items()
    ]
    write_jsonl(OUTPUT / "documents.jsonl", documents)
    write_json(OUTPUT / "fetch_manifest.json", dict(metadata, documents=len(groups),
               requirements=sum(map(len, groups.values())), excluded_files=["testData.csv"]))
    return groups, metadata


def chunks(groups, metadata):
    # Keep CSV row boundaries and section labels. Split oversized individual rows
    # on whitespace and retain their source row ID in each fragment.
    unique = {}
    for doc in read_jsonl(OUTPUT / "kb_documents.jsonl"):
        by_section = defaultdict(list)
        for index, sentence, security in groups[doc["doc_id"].removeprefix("KagglePURE:")]:
            for part in textwrap.wrap(sentence, width=2300, break_on_hyphens=False):
                by_section["security" if security else "specific_requirements"].append((index, part))
        chunk_index = 0
        for section, rows in by_section.items():
            batch = []
            for item in [*rows, None]:
                if batch and (item is None or sum(len(v)+1 for _, v in batch)+len(item[1]) > 2300):
                    content = "\n".join(v for _, v in batch)
                    digest = hashlib.sha256(content.encode()).hexdigest()
                    unique.setdefault(digest, dict(doc_id=doc["doc_id"], dataset_source="PURE",
                        ieee_section=section, content=content, chunk_index=chunk_index,
                        content_hash=digest, token_count=token_count(content),
                        metadata=dict(metadata, language="en", row_ids=[k for k, _ in batch],
                                      tail=item is None or token_count(content)<300)))
                    chunk_index += 1
                    batch = []
                if item is not None:
                    batch.append(item)
    write_jsonl(OUTPUT / "chunks.jsonl", unique.values())
    write_json(OUTPUT / "chunk_report.json", dict(unique_chunks=len(unique), issues=[]))


if __name__ == "__main__":
    import sys
    groups, metadata = prepare()
    if sys.argv[1:] == ["chunk"]:
        chunks(groups, metadata)

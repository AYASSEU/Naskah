"""Local OpenAI-compatible E5 service, using pinned offline weights."""
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

import torch
from torch.nn import functional as F
from transformers import AutoModel, AutoTokenizer

MODEL = "multilingual-e5-small-614241f6-pad1536"
tokenizer = AutoTokenizer.from_pretrained("/model")
encoder = AutoModel.from_pretrained("/model").eval()
torch.set_num_threads(3)


@torch.inference_mode()
def encode(texts, role):
    # Window long inputs so requirements near the end remain represented.
    inputs = tokenizer([role + ": " + text for text in texts], padding=True,
                       truncation=True, max_length=512, return_overflowing_tokens=True,
                       return_tensors="pt")
    mapping = inputs.pop("overflow_to_sample_mapping")
    sums = torch.zeros(len(texts), 384)
    for start in range(0, len(mapping), 4):
        batch = {key: value[start:start+4] for key, value in inputs.items()}
        hidden = encoder(**batch).last_hidden_state
        sums.index_add_(0, mapping[start:start+4],
                        (hidden * batch["attention_mask"].unsqueeze(-1)).sum(1))
    return F.pad(F.normalize(sums), (0, 1152)).tolist()


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + os.environ["E5_TOKEN"]):
            return True
        self.reply(401, {"error": "unauthorized"})
        return False

    def do_GET(self):
        if self.authorized():
            if self.path == "/v1/models":
                self.reply(200, {"data": [{"id": MODEL, "object": "model"}]})
            else:
                self.reply(404, {})

    def do_POST(self):
        if not self.authorized():
            return
        if self.path != "/v1/embeddings":
            return self.reply(404, {})
        try:
            length = int(self.headers["Content-Length"])
            if not 0 < length <= 500000:
                raise ValueError()
            req = json.loads(self.rfile.read(length))
            texts = req["input"]
            if isinstance(texts, str):
                texts = [texts]
            role = req.get("input_type", "query")
            if (req["model"] != MODEL or req.get("dimensions", 1536) != 1536 or
                role not in ("query", "passage") or not isinstance(texts, list) or
                not 1 <= len(texts) <= 32 or not all(isinstance(t, str) and 0 < len(t) <= 100000 for t in texts)):
                raise ValueError()
        except (TypeError, KeyError, ValueError):
            return self.reply(400, {"error": "invalid_embedding_request"})
        vectors = encode(texts, role)
        self.reply(200, {"model": MODEL, "object": "list", "data": [
            {"object": "embedding", "index": i, "embedding": v} for i, v in enumerate(vectors)]})


HTTPServer(("0.0.0.0", 4011), Handler).serve_forever()

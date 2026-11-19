"""Local CPU BERTScore with document-wide greedy matching over contextual windows."""
import torch
from transformers import AutoModel, AutoTokenizer
from .common import EvaluationError, scope, provenance

MODEL = "distilbert/distilbert-base-multilingual-cased"
REVISION = "45c032ab32cc946ad88a166f7cb282f58c753c2e"

@torch.inference_mode()
def evaluate(data):
    selected = scope(data)
    pairs = data.get("pairs", [])
    if not 1 <= len(pairs) <= 10:
        raise EvaluationError("invalid_input")
    tokenizer = AutoTokenizer.from_pretrained("/opt/bert-model", local_files_only=True)
    model = AutoModel.from_pretrained("/opt/bert-model", local_files_only=True).eval()
    torch.set_num_threads(2)
    def encode(text):
        if not isinstance(text,str) or not text.strip() or len(text)>100000:
            raise EvaluationError("invalid_input")
        ids = tokenizer.encode(text, add_special_tokens=False, truncation=False)
        if not ids or len(ids)>8192:
            raise EvaluationError("evaluation_too_large")
        vectors, masks = [], []
        for start in range(0,len(ids),510):
            tokens = tokenizer.build_inputs_with_special_tokens(ids[start:start+510])
            states = model(torch.tensor([tokens]),output_hidden_states=True).hidden_states[5]
            vectors.append(states[0])
            masks.append(torch.tensor([False]+[True]*(len(tokens)-2)+[False]))
        return torch.nn.functional.normalize(torch.cat(vectors),dim=-1), torch.cat(masks)
    results = []
    for pair in pairs:
        if pair.get("language") not in ("en","id") or pair["language"] != pair.get("reference_language"):
            raise EvaluationError("language_mismatch")
        if selected=="research" and (pair.get("is_thesis_run") is not True or pair.get("dev_seed") or pair.get("dataset_source")=="dev_seed"):
            raise EvaluationError("dev_seed_excluded")
        (candidate, candidate_mask), (reference, reference_mask) = encode(pair["prediction"]), encode(pair["reference"])
        pmax, rmax = [], torch.full((len(reference),),-1.)
        for chunk in candidate.split(256):
            cosine = chunk @ reference.T
            pmax.append(cosine.amax(dim=1))
            rmax = torch.maximum(rmax,cosine.amax(dim=0))
        p,r = torch.cat(pmax)[candidate_mask].mean().item(),rmax[reference_mask].mean().item()
        results.append({"case_id":pair.get("case_id"),"precision":p,"recall":r,"f1":2*p*r/(p+r) if p+r else 0})
    return {"kind":"bertscore","data_scope":selected,"results":results,"provenance":{**provenance({"data":data,"revision":REVISION,"layer":5,"window":510,"method":"greedy_uniform_v1"}),"model":MODEL,"revision":REVISION,"layer":5,"window_tokens":510,"idf":False,"rescale_with_baseline":False}}

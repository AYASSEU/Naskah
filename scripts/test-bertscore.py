"""Run inside the local evaluator image with networking disabled."""
from bert_score import score
from evaluation_scripts.bertscore import evaluate

candidate = "Sistem harus mencatat transaksi."
references = [candidate, "Burung itu terbang di hutan."]
pairs = [dict(prediction=candidate, reference=r, language="id", reference_language="id") for r in references]
actual = evaluate({"data_scope":"dev", "pairs":pairs})["results"]
expected = score([candidate]*2, references, model_type="/opt/bert-model", num_layers=5,
                 device="cpu", idf=False, use_fast_tokenizer=True)
for i, row in enumerate(actual):
    for j, key in enumerate(("precision","recall","f1")):
        assert abs(row[key]-float(expected[j][i])) < 1e-5, (key,row[key],float(expected[j][i]))
assert actual[0]["f1"] > .99999 and actual[0]["f1"] > actual[1]["f1"]
print("Reference parity passed. F1:", [round(row["f1"],6) for row in actual])
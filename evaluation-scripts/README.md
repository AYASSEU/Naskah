# Local evaluation tools

Run `pnpm local:evaluation` to install the CPU dependencies and pinned multilingual model in the local Docker image. Initial setup requires a download. Run `pnpm evaluation bertscore --input evaluation-scripts/examples/bertscore.json --output artifacts/bertscore.json` for offline scoring. The service memory limit is 3 GiB. JSON/CSV exports use the bertscore dataset. Existing ROUGE data remains available as historical evidence.

Final mapping of BAB IV tables/figures, exact export/analysis commands, research
eligibility and privacy limits: [thesis data guide](../docs/thesis-data-guide.md).
Research enrollment is not yet a UI flow; changing a file scope/flag is not proof
of real-study provenance.

B8 implements SUS, expert descriptions, heading completeness, ROUGE-1/2/L,
Wilcoxon/Mann–Whitney with effect sizes/Holm correction, and pseudonymized local
API exports. These tools never call an AI provider. Examples are synthetic dev
data and must not be used as research findings.

From the repository root, run `pnpm local:evaluation`, then
`pnpm evaluation sus --input evaluation-scripts/examples/sus.json`.
Use `expert`, `stats`, `structure`, `rouge`, or `export` for other operations.
Numerical commands use the pinned Docker image without network access; the
exporter uses host Python stdlib and the local owner API, without a database key.

For standalone Python use `pip install -r requirements.txt`, then
`python -m evaluation_scripts --help` from this directory. Verify with
`pnpm test:python` from the repository root. See
[B8 evaluation](../docs/B8-evaluation.md) for input schemas, UI flow, separation,
limits, assumptions, reproducibility, and research eligibility.

# Phase 2 evaluation scripts
Implement Python tools for rouge-score (ROUGE-1, ROUGE-2, ROUGE-L precision,
recall, F1), heading structure checks, SciPy Wilcoxon signed-rank for matched
ratings or Mann–Whitney U for independent groups (record study design first),
and SUS. SUS: odd items response minus 1, even items 5 minus response; total
times 2.5. Preserve participant pseudonyms and pairing. Export JSON matching
RougeSchema and a separate report with sample size, test, statistic, p-value,
effect size and correction assumptions. No scripts execute in Phase 1.

`apps/web/public/samples/rouge-results.json` is synthetic demonstration input.
Do not report it as measured research data. Benchmark/interpretation references:
Brooke (1996), Bangor/Kortum/Miller (2009), Sauro (2011).

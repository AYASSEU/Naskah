# Panduan data dan reproduksi BAB IV

Checkpoint B10, 11 November 2026. Semua angka acceptance B5–B9 berasal dari data
**sintetis/dev**, bukan temuan penelitian. Panduan ini memetakan calon tabel dan
gambar BAB IV ke sumber serta perhitungannya; nomor final mengikuti naskah penulis.

## Kapan run boleh menjadi data penelitian

Syarat minimum: consent/protokol yang disetujui, baseline manusia dan bahasa yang
jelas, split corpus train/held-out yang sah sebelum chunking, run completed
non-mock dengan `is_thesis_run=true`, tanpa retrieval `dev_seed`, dan provenance
model/prompt/input/version yang dapat diaudit. API evaluasi selalu memeriksa
owner dan `scope=dev|research`; trigger DB memeriksa kesesuaian scope.

**Enrollment/pembuatan run penelitian belum tersedia sebagai alur UI.** Jangan
memperbaikinya dengan UPDATE flag atau mengganti `data_scope` JSON. Implementasi
enrollment dengan guard/provenance dan pengujian merupakan pekerjaan sebelum
studi. Keberhasilan API asli saja belum membuat proyek eligible. Saat checkpoint,
scope research kosong dan seluruh run acceptance `is_thesis_run=false`.

Pisahkan lingkungan/corpus dev dan penelitian. Bekukan protokol desain paired
atau independent **sebelum** kasus dibuat; satu kasus menyimpan snapshot sistem,
baseline, bahasa, desain dan provenance. Pada paired, A dan B harus dinilai
lengkap; repeated cases dirata-ratakan per peserta, bukan dianggap sampel baru.
Independent memerlukan dua kelompok peserta yang tidak tumpang tindih.

## Sumber setiap tabel dan gambar

| Calon keluaran BAB IV | Sumber persisten / ekspor | Perhitungan dan batas |
| --- | --- | --- |
| Tabel pengujian FR | [Traceability](traceability.md), report B9 lokal | Lulus/gagal acceptance perangkat lunak; tidak dicampur statistik responden |
| Tabel corpus dan split | Manifest fetch/split/chunk/verify ingestion, `srs_knowledge_base`, `ground_truth_docs` | Count/hash per sumber/proyek/bahasa/split, izin dan model; jangan menghitung chunk sebagai dokumen independen |
| Tabel RQ1 durasi/kelengkapan | `srs_generation_logs`, `retrieved_chunk_log`, `workflow_runs`; `logs.csv` | Status dan denominator dinyatakan; rata-rata/median/SD durasi detik dan heading completeness untuk completed runs |
| Gambar RQ1 distribusi durasi/kelengkapan | Baris `logs.csv` yang sama | Dot/box plot per run dengan n/status; completeness adalah coverage heading, bukan kebenaran isi |
| Tabel RQ2 empat dimensi ahli | `evaluation_cases`, `blind_assignments`, `blind_source_maps`, `expert_reviews`; `reviews.csv` / `stats_input` | Skala 1–5: unambiguous, complete, correct, verifiable; rata-rata lintas kasus per peserta, lalu deskriptif antar peserta |
| Gambar RQ2 sistem vs manusia | Input peserta yang sama untuk statistik | Paired dot plot bila berpasangan; tampilkan kelompok terpisah jika independent; jangan menautkan peserta berbeda |
| Tabel inferensi RQ2 | `statistical_results`, output `stats` | Wilcoxon paired / Mann–Whitney independent, dua sisi, Holm empat dimensi, effect size dan CI jika tersedia |
| Tabel RQ2 ROUGE | `rouge_results`, snapshot teks privat + baseline | ROUGE-1/2/L precision/recall/F1, bahasa/tokenizer/stemmer, valid_comparison; overlap bukan mutu semantik |
| Tabel/gambar RQ3 SUS | `participants`, `sus_responses`; `sus.csv` | Sepuluh jawaban; skor per peserta dan mean/median/SD; satu respons immutable/peserta; 0–100 bukan persentase |
| Tabel provenance/batas | Manifest, output JSON analisis dan protokol privat | Commit, model yang dilayani, seed, versi engine, SHA-256 input, n/exclusion, tanggal dan keterbatasan |

Tool saat ini menghasilkan JSON/CSV dan dashboard, **belum menyediakan generator
gambar BAB IV/nomor tabel otomatis**. Buat grafik dari baris ekspor yang dibekukan
dengan script plotting yang diarsipkan; label satuan/n/scope/desain. Jangan
menggambar dari contoh/fixture lalu melabelinya hasil responden. Mapping A/B
hanya dibuka secara eksplisit setelah seluruh review kasus lengkap; selesaikan
seluruh kasus yang direncanakan sebelum unblinding. Operator lokal masih dapat
melihat DB sehingga batas blinding harus dijelaskan dalam metode.

## Reproduksi demonstrasi sintetis

Jalankan dari root dengan Docker siap. Seluruh file contoh berlabel dev:

```powershell
pnpm local:evaluation
pnpm evaluation sus --input evaluation-scripts/examples/sus.json --output artifacts/sus.json
pnpm evaluation expert --input evaluation-scripts/examples/expert.json --output artifacts/expert.json
pnpm evaluation stats --input evaluation-scripts/examples/expert.json --output artifacts/stats.json
pnpm evaluation rouge --input evaluation-scripts/examples/rouge.json --output artifacts/rouge.json
```

Wrapper numerik memakai image evaluator yang dipin, network container dimatikan.
NumPy/SciPy/rouge-score, versi Python, seed dan input digest disimpan pada JSON.
CLI/export membutuhkan Python host untuk export saja; `EVALUATION_PYTHON_PATH`
dapat menunjuk executable Python lokal. Metode dan limit lengkap:
[B8-evaluation.md](B8-evaluation.md).

## Ekspor dan reproduksi data dari UI

Dengan web live aktif, kasus/review/SUS dev yang Anda masukkan sendiri dapat
diekspor. Acceptance otomatis membersihkan datanya; ekspor kosong bukan error.

```powershell
pnpm evaluation export --scope dev --output artifacts/evaluation-dev
pnpm evaluation expert --input artifacts/evaluation-dev/snapshot.json --output artifacts/expert-current.json
pnpm evaluation stats --input artifacts/evaluation-dev/snapshot.json --output artifacts/stats-current.json
```

Export menulis `snapshot.json`, `logs.csv`, `cases.csv`, `reviews.csv`, `sus.csv`,
`rouge.csv`, `statistics.csv` dan README. CLI memilih **paired** untuk `stats_input`
secara default. Untuk independent, pilih desain independent di dashboard/export
API, atau bentuk input dari review lengkap dengan desain itu:

```powershell
$snapshot = Get-Content -Raw -Encoding UTF8 'artifacts/evaluation-dev/snapshot.json' | ConvertFrom-Json
@{
  data_scope = $snapshot.data_scope
  design = 'independent'
  reviews = @($snapshot.datasets.reviews | Where-Object { $_.design -eq 'independent' })
} | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 'artifacts/expert-independent-input.json'
pnpm evaluation expert --input artifacts/expert-independent-input.json --output artifacts/expert-independent.json
pnpm evaluation stats --input artifacts/expert-independent-input.json --output artifacts/stats-independent.json
```

SUS CLI memerlukan `responses`, bukan seluruh snapshot. Gunakan jawaban dari
ekspor untuk menghitung ulang, bukan percaya skor yang diimpor:

```powershell
$snapshot = Get-Content -Raw -Encoding UTF8 'artifacts/evaluation-dev/snapshot.json' | ConvertFrom-Json
@{
  data_scope = $snapshot.data_scope
  responses = @($snapshot.datasets.sus)
} | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 'artifacts/sus-current-input.json'
pnpm evaluation sus --input artifacts/sus-current-input.json --output artifacts/sus-current.json
```

Script Python stdlib berikut menghasilkan tabel RQ1 deskriptif dari snapshot
yang sama, hanya completed runs; tidak memerlukan credential. Bagian ini
memerlukan Python host 3.12+ yang benar-benar terpasang di PATH (alias Microsoft
Store `python.exe` saja belum cukup). Jika perlu, gunakan executable virtualenv
ingestion atau path `EVALUATION_PYTHON_PATH` menggantikan `python` pada baris akhir.
Wrapper `pnpm evaluation` di atas dapat memakai bundled Python secara otomatis.

```powershell
$summaryScript = @'
import json, statistics, sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
logs = data["datasets"]["logs"]
complete = [row for row in logs if row["status"] == "completed"]
def describe(values):
    return {"n": len(values), "mean": statistics.mean(values) if values else None,
            "median": statistics.median(values) if values else None,
            "sd": statistics.stdev(values) if len(values) > 1 else None}
result = {"data_scope": data["data_scope"], "total_logs": len(logs),
          "excluded_noncompleted": len(logs) - len(complete),
          "seconds": describe([row["seconds"] for row in complete]),
          "heading_completeness_percent": describe([row["completeness"] for row in complete])}
Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
'@
$summaryScript | python - 'artifacts/evaluation-dev/snapshot.json' 'artifacts/rq1-summary.json'
```

Dashboard overview saat ini merangkum semua log dalam scope; tabel di atas
memilih completed secara eksplisit. Jangan menyamakan denominator tanpa meninjau
status. Jika menyatakan tingkat sukses, gunakan semua log sebagai denominator
dan nyatakan pembatalan/kegagalan. Completeness mengecek heading wajib template.
Untuk cek ulang naskah privat dan template yang dipakai run:

```powershell
pnpm evaluation structure --input artifacts/private-structure-input.json --output artifacts/structure-current.json
```

Input ini harus Anda siapkan: `{data_scope, markdown, template}`; template memuat
chapters dan subsections required dari run, bukan template yang sudah berubah.
Tidak ada file naskah privat otomatis dalam ekspor anonim.

ROUGE sebaiknya dihitung pada UI terhadap case snapshot. Untuk offline:

```powershell
pnpm evaluation rouge --input artifacts/private-rouge-input.json --output artifacts/rouge-current.json
```

Ikuti schema `pairs` pada [contoh ROUGE](../evaluation-scripts/examples/rouge.json),
ganti dengan snapshot prediction/reference yang sah dan bahasa masing-masing.
Simpan provenance serta case ID privat untuk impor server. Pseudonim case ekspor
bukan ID database untuk impor. Impor statistik/ROUGE server dihitung ulang
terhadap input yang dimiliki, bukan dipercaya karena label scope/provenance saja.

Setelah enrollment/provenance penelitian benar-benar tersedia dan lolos guard,
ekspor penelitian menggunakan:

```powershell
pnpm evaluation export --scope research --output artifacts/evaluation-research
pnpm evaluation expert --input artifacts/evaluation-research/snapshot.json --output artifacts/expert-research.json
pnpm evaluation stats --input artifacts/evaluation-research/snapshot.json --output artifacts/stats-research.json
```

Untuk SUS/RQ1, ulang transformasi di atas dengan path snapshot research;
`data_scope` harus berasal dari snapshot. Jangan mengubah flag data dev.
Snapshot kosong/kurang peserta harus menolak inferensi, bukan dibuatkan angka.

## Asumsi, penyamaran dan arsip

SUS: kontribusi ganjil `jawaban−1`, genap `5−jawaban`, total ×2,5. Ahli: unit
analisis mean peserta lintas kasus. Minimal dua pasangan/peserta per kelompok
untuk inferensi; CI efek bootstrap aproksimasi hanya bila n≥5 dan tidak degenerat.
Seed default 20261110, Holm untuk empat dimensi; CI tidak dikoreksi multiplikitas.
Jangan menyimpulkan sebab-akibat atau mutu keseluruhan dari p-value/ROUGE saja.
ROUGE harus bahasa sama; override beda bahasa hanya dev dan tidak valid untuk
kesimpulan. Tokenizer ASCII/lowercase memiliki keterbatasan linguistik.

Ekspor adalah **pseudonimisasi**, bukan anonimitas yang terjamin: HMAC 24 digit
hex mengganti ID peserta/proyek/case/session. Kode peserta, UUID asli, credential,
naskah, alasan/komentar bebas dan judul tidak disertakan. Pseudonim tetap dapat
ditautkan dalam owner/scope yang sama. Key aplikasi yang berubah mengubah
pseudonim dan sesi; jangan rotasi selama studi tanpa rencana migrasi.

Simpan snapshot/input/output/protokol/manifest/commit/hash secara privat dengan
akses dan retensi yang ditentukan. Jangan commit ekspor, raw data, consent,
baseline atau key. Review narasi/kutipan secara manual sebelum dibagikan;
redaksi otomatis ekspor tidak mencakup berkas sumber privat. Local-owner satu
laptop dan cookie peserta tujuh hari belum menjadi portal responden independen.

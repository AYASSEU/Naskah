# B8 — evaluasi lokal

Backend evaluasi tersedia di `/evaluation` dalam mode `live`. Semua penerimaan B8
menggunakan data sintetis, Supabase lokal, dan provider mock. Hasil uji ini bukan
temuan penelitian. Tidak ada provider berbayar atau proyek Supabase hosted yang
dipakai.

## Menjalankan

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode live
```

Startup menyalakan n8n, Supabase, compiler dan `naskah-evaluation` pada
`127.0.0.1:8010`. Untuk memperbarui layanan evaluasi saja, jalankan
`pnpm local:evaluation`. Script membuat token lokal di `.env.local` dan file
runtime yang diabaikan Git; jangan menyalin nilainya ke browser atau repositori.
Perhitungan berlangsung dalam proses Python terpisah, maksimal dua pekerjaan,
batas 45 detik, container nonroot/read-only 768 MiB. Docker pertama kali
membutuhkan unduhan image/dependency; analisis numerik tidak memanggil provider.

Migration B8 adalah `20261111045203_b8_evaluation.sql`; generated types berasal
dari database lokal. Jangan reset database berisi pekerjaan pengguna. Pada
instalasi yang belum menerima migration, ikuti alur migration CLI lokal yang
dipakai proyek; periksa status/history sebelum menerapkan.

## Alur UI

1. Pilih **Data uji**. **Siapkan kasus uji** membuat snapshot sintetis yang jelas
   berlabel pengembangan. Untuk naskah sendiri, buat kasus dari proyek yang sudah
   dalam review/final, masukkan baseline manusia, bahasanya dan catatan asal.
2. Pilih desain **Berpasangan** atau **Independen** sebelum kasus dibuat. Desain
   dan snapshot tidak berubah setelah tersimpan.
3. Masukkan kode samaran baru, peran dan persetujuan. Browser menerima cookie
   HttpOnly bertanda tangan, terpisah untuk data uji dan penelitian. Kode yang
   sedang dimiliki sesi lain tidak dapat diambil alih.
4. Pakar menilai empat dimensi: unambiguous, complete, correct, verifiable,
   masing-masing 1–5 dengan alasan. Desain berpasangan memberi A dan B; desain
   independen memberi satu dokumen A dan mempertahankan sumber peserta lintas
   kasus independen. Mapping baru boleh dibuka secara eksplisit setelah semua
   penilaian kasus itu dikirim. Selesaikan semua kasus yang direncanakan sebelum
   membuka mapping agar identitas sumber tidak memengaruhi penilaian berikutnya.
5. SUS menerima sepuluh jawaban 1–5. Server dan trigger database menghitung skor;
   skor dari klien diabaikan. Satu jawaban SUS per peserta, tersimpan setelah
   reload. Pengiriman ulang identik idempoten; perubahan jawaban ditolak.
6. Hitung statistik pada tab pakar, atau ROUGE pada tab ROUGE. Ekspor JSON/CSV
   mengikuti kelompok data yang sedang dipilih. Impor laporan terverifikasi
   dihitung ulang terhadap snapshot/review milik owner sebelum disimpan.

Penilaian yang sudah dikirim immutable. Penilaian A yang belum disertai B pada
desain berpasangan belum masuk ringkasan, ekspor, atau analisis sumber.
Pilihan **Ganti peserta** menggunakan kode baru. Pemulihan kode setelah cookie
kedaluwarsa belum tersedia; cookie berlaku tujuh hari dan bukan akun peserta
jarak jauh. Sistem masih memakai autentikasi local-owner satu laptop; operator
lokal tetap dapat mengakses naskah dan database. Ini bukan infrastruktur uji
klinis atau portal responden publik.

## Pemisahan data

Semua API membawa `scope=dev|research`, default `dev`, dan selalu dibatasi owner.
Peserta, kasus, assignment, review, SUS, ROUGE, statistik dan ekspor terpisah
melalui `is_thesis_run`. True source disimpan dalam tabel mapping tersendiri,
bukan di payload dokumen buta. RLS dan pencabutan grant anon/authenticated
melindungi tabel; akses server memakai transaksi yang memeriksa owner.

Kasus/SUS penelitian membutuhkan run sukses `completed`, `is_thesis_run=true`,
tanpa metrik provider mock atau chunk `dev_seed`. Snapshot mock tidak dapat
dipromosikan lewat UI/API evaluasi. Penandaan run penelitian nyata dan enrollment
studi adalah pekerjaan lanjutan; dataset penelitian saat ini tetap kosong.
Script Python juga menolak record pengembangan yang diberi scope penelitian,
tetapi flag file offline bukan bukti asal data; impor server selalu diverifikasi
ulang. Array laporan Phase 1 lama hanya diterima sebagai dev/unverified.

Ekspor memakai pseudonim HMAC 24 digit hex untuk peserta/proyek/kasus/sesi.
Kode peserta, UUID asli, komentar, alasan bebas, judul/naskah, dan credential
tidak disertakan. CSV mengutip sel serta mengamankan formula. Pseudonim dapat
ditautkan dalam owner/scope yang sama; perlakukan ekspor sebagai data penelitian
yang tetap perlu dikendalikan. JSON menyertakan `stats_input` untuk reproduksi.

Batas reader: 200 kasus/proyek pilihan, 2.000 review lengkap, 5.000 log/SUS/ROUGE,
200 laporan statistik. Dataset yang melewati batas ditolak dengan
`evaluation_too_large`, bukan dipotong diam-diam. Statistik maksimal 200 peserta
per sumber. ROUGE maksimal 10 pasang, 100.000 karakter/5.000 token per teks.

## Metode

- SUS: `(jumlah kontribusi ganjil response−1 dan genap 5−response) × 2,5`.
  Rentang 0–100; skor bukan persentase keberhasilan. Rata-rata, median, dan SD
  memakai peserta, SD sampel tidak ditampilkan untuk satu peserta.
- Penilaian pakar: rata-rata setiap peserta lintas kasus, lalu ringkasan antar
  peserta. Kasus berulang bukan tambahan sampel independen. Desain berpasangan
  memerlukan pasangan peserta/kasus yang cocok; independen memerlukan peserta
  dua kelompok yang tidak tumpang tindih. Minimal dua peserta per kelompok/pasangan
  untuk inferensi; deskriptif tetap tersedia untuk sampel lebih kecil.
- Wilcoxon dua sisi: exact tanpa ties/zero untuk n≤50; ties/zero memakai seluruh
  permutasi tanda untuk n≤12, selebihnya 9.999 permutasi dengan seed tersimpan.
  Seluruh selisih nol memberi W=0, p=1, effect=0 dan peringatan.
- Mann–Whitney U dua sisi: exact tanpa ties dan kelompok terkecil ≤8; lainnya
  permutasi label lengkap jika kombinasi ≤50.000 atau 9.999 permutasi.
  Efek positif berarti skor sistem lebih tinggi: paired rank-biserial atau
  Cliff's delta. Koreksi Holm untuk empat dimensi, alpha 0,05.
- CI efek adalah bootstrap persentil peserta 2.000 resampling, hanya bila n≥5
  per kelompok/pasangan dan sampel tidak degenerat. CI aproksimasi ini tidak
  dikoreksi multiplikitas. Seed default 20261110; p-value kecil bukan bukti
  kausalitas. Interpretasi lokasi Wilcoxon memerlukan selisih simetris;
  interpretasi pergeseran median Mann–Whitney memerlukan bentuk distribusi
  yang sebanding.
- ROUGE-1/2/L melaporkan precision, recall, F1 memakai tokenizer ASCII/lowercase
  `rouge-score==0.1.2`, tanpa stemming secara default. Porter hanya untuk dua
  teks Inggris. ROUGE-L memakai rolling-row LCS agar memori terbatas, diuji
  terhadap implementasi library. ROUGE mengukur overlap, bukan kebenaran SRS.
  Perbedaan bahasa ditolak; override dev perlu alasan dan hasil ditandai tidak
  valid untuk kesimpulan. Penelitian tidak menerima override beda bahasa.

Versi engine, Python, NumPy, SciPy, rouge-score dan SHA-256 input dicatat dalam
provenance. Referensi implementasi: [SciPy Wilcoxon](https://docs.scipy.org/doc/scipy-1.16.2/reference/generated/scipy.stats.wilcoxon.html),
[Mann–Whitney U](https://docs.scipy.org/doc/scipy-1.16.2/reference/generated/scipy.stats.mannwhitneyu.html),
dan [Google rouge-score](https://github.com/google-research/google-research/tree/master/rouge).

## Python / CLI

Jalankan dari root. Wrapper Windows memakai image yang sama dan menonaktifkan
network container untuk operasi numerik. Contoh file seluruhnya sintetis:

```powershell
pnpm evaluation sus --input evaluation-scripts/examples/sus.json --output artifacts/sus.json
pnpm evaluation expert --input evaluation-scripts/examples/expert.json --output artifacts/expert.json
pnpm evaluation stats --input evaluation-scripts/examples/expert.json --output artifacts/stats.json
pnpm evaluation rouge --input evaluation-scripts/examples/rouge.json --output artifacts/rouge.json
pnpm evaluation export --scope dev --output artifacts/evaluation-dev
pnpm evaluation stats --input artifacts/evaluation-dev/snapshot.json --output artifacts/stats-current.json
```

Export menggunakan Python host stdlib, signed local-owner API pada port 3000,
tanpa key Supabase. `EVALUATION_PYTHON_PATH` dapat menunjuk Python host sendiri.
Untuk lingkungan Python mandiri: `pip install -r evaluation-scripts/requirements.txt`,
lalu dari folder `evaluation-scripts` gunakan `python -m evaluation_scripts` dengan
argumen operasi/input/output yang sama. Operasi `structure` menerima
`{data_scope, markdown, template}` dengan template kontrak proyek.

`stats`/`expert` dapat membaca ekspor lengkap atau objek `{data_scope, design,
reviews}`. `sus` menerima `{data_scope, responses:[{participant, answers,
is_thesis_run}]}`; banyak respons wajib memiliki peserta unik. ROUGE membutuhkan
`pairs` berisi prediction/reference/bahasa; ekspor anonim sengaja tidak memuat
naskah. Simpan input naskah secara privat. Impor laporan ROUGE harus menggunakan
case_id asli yang masih dimiliki server, bukan pseudonim ekspor. Laporan contoh
tanpa kasus hanya untuk analisis offline.

## Pemeriksaan

```powershell
pnpm test:python
pnpm test:b8
$env:NASKAH_E2E_MODE='live'
pnpm test:e2e tests/e2e/live-evaluation.spec.ts
node scripts/cleanup-b8-ui.mjs
node scripts/test-database.mjs
```

HTTP acceptance membersihkan hanya proyek/peserta sintetis unik buatannya.
UI mencatat cleanup miliknya di artifacts yang diabaikan Git; helper membatasi
penghapusan ke kode B8UI dengan UUID-prefix yang telah dicatat. Kasus contoh dev
yang diminta lewat UI boleh tetap tersedia. Trace browser default mati karena
memuat sesi lokal; aktifkan hanya untuk debugging privat dengan
`NASKAH_E2E_TRACE=1`. Runner UI menyunting credential dari output terminal.

Goldens SUS/struktur dipakai bersama TypeScript dan Python. Uji numerik mencakup
exact/ties/zero, pasangan hilang, tumpang tindih kelompok, pseudoreplikasi,
reproduksibilitas bootstrap, penolakan data sintetis penelitian dan ROUGE-L parity.
Hasil akhir/checkpoint pengujian dicatat di `backend-phase-reports.md`.

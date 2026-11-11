# Menjalankan dan memeriksa Naskah lokal

Checkpoint B9 memakai backend lokal dan provider mock. Tidak ada hasil penelitian
nyata atau keberhasilan API berbayar yang diklaim dari acceptance ini.

## Startup Windows

Dari root proyek, jalankan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode live
```

Biarkan terminal webapp terbuka. Ctrl+C menghentikan webapp; container tetap
berjalan. Jika port 3000 sudah dipakai Naskah, startup memeriksa layanan lalu
mempertahankan server tersebut. Buka:

| Layanan | Alamat |
| --- | --- |
| Webapp | http://127.0.0.1:3000 |
| Evaluasi | http://127.0.0.1:3000/evaluation |
| Settings | http://127.0.0.1:3000/settings |
| n8n | http://127.0.0.1:5678 |
| Supabase Studio | http://127.0.0.1:54323 |
| Parser/compiler health | http://127.0.0.1:8000/health |
| Evaluasi Python health | http://127.0.0.1:8010/health |

Script menghidupkan Docker Desktop bila diperlukan, memulai container existing,
Supabase, compiler dan evaluator tanpa reset volume. Compiler memakai Docker --init untuk memanen proses sisa LibreOffice. Token layanan dibuat dan
disimpan lokal. `.env.local`, backup, corpora, hasil ekspor dan artifacts tidak
boleh dimasukkan Git. Mode `live` berarti layanan backend dipakai; provider LLM
saat acceptance tetap mock pada port 4010.

Jika port dipakai aplikasi lain, startup tidak mengganti proses itu. Hentikan aplikasi tersebut
sendiri atau pilih port lain melalui konfigurasi. Jangan membunuh proses atau
menghapus volume yang tidak diketahui. Backup n8n dan runtime laptop berada
di `%LOCALAPPDATA%\n8n-backups` dan `%LOCALAPPDATA%\naskah-runtime`.

## Acceptance B9 dengan mock

Pastikan kedua provider pada Settings memakai mock lokal, knowledge base berisi
dev_seed dan n8n siap. Pengujian menolak URL/provider non-mock. Kemudian:

```powershell
pnpm test:b9
pnpm typecheck
pnpm lint
pnpm test
pnpm audit:slop
pnpm check:contrast
pnpm scan:secrets
```

`test:b9` menjalankan seluruh counterpart browser live di kedua tema, regresi
workflow B5, HTTP B6, dokumen B7, 30 kompilasi/process-lifecycle, evaluasi B8, Python dan isolasi database secara
berurutan. Jangan menjalankan suite integrasi lain bersamaan: skenario mock,
credential dan himpunan analisis adalah state bersama. Laporan ringkas ada di
`artifacts/b9/acceptance.json`. Suite Phase 1 memakai fixture IndexedDB dan
dijalankan tersendiri pada server `-Mode mock`; fixture tersebut tidak dianggap
hasil provider atau database live.

Siklus Settings menguji kunci dummy A/B: simpan baru, rotasi, tolak kunci invalid,
hapus dan blokir Generate, hilangkan hanya lima credential milik Naskah, lalu
**Terapkan ulang sambungan** dan Generate lagi. Volume n8n dan credential lain
tidak dihapus. Backup encrypted pengaturan mock dibuat sebelum uji dan
dipulihkan setelahnya. API/DOM/storage, workflow, execution dan log diperiksa
terhadap kebocoran credential. Trace browser default mati; trace debugging
bersifat privat dan dapat memuat cookie.

Jika pengujian terhenti sebelum pemulihan selesai, jangan mengganti pengaturan
lagi. Jalankan dari terminal proyek:

```powershell
$env:TSX_TSCONFIG_PATH='apps/web/tsconfig.json'
node --conditions=react-server --env-file=apps/web/.env.local --import tsx scripts/b9-runtime.ts restore
node --conditions=react-server --env-file=apps/web/.env.local --import tsx scripts/b9-runtime.ts cleanup
```

Pemulihan menggunakan snapshot encrypted yang owner-nya diverifikasi; cleanup
hanya menyentuh ID/peserta/digest sintetis yang tercatat dalam manifest B9.
Snapshot dibuang setelah restore berhasil. Tidak ada endpoint test backdoor di
backend aplikasi. Jika snapshot masih ada, pertahankan berkas dan encryption key
sampai pemulihan selesai.

Untuk production build, hentikan server dev dengan Ctrl+C terlebih dahulu:

```powershell
pnpm build
```

Jangan menjalankan build dan dev bersamaan pada output `.next` yang sama di
Windows/OneDrive. Setelah build, jalankan kembali startup di atas.

## Uji manual provider asli — dilakukan pengguna, belum dijalankan B9

| Tugas pengguna | Status checkpoint |
| --- | --- |
| Key REST n8n lokal | Sudah tersimpan dan diuji; perbarui hanya bila kedaluwarsa/ditolak. |
| Key DeepSeek dan provider embedding nyata | Belum dipakai; isi sendiri melalui Settings untuk uji manual. |
| Corpus penelitian, izin sumber dan ingestion nyata | Belum dimuat dalam DB penelitian checkpoint ini; tinjau manifest/drop B4. |

Integrasi DeepSeek sudah ada; acceptance mock membuktikan jalur orkestrasi,
bukan kualitas atau keberhasilan provider asli. Pengguna memasukkan key melalui
Settings. Jangan memberikan key lewat chat atau menyimpannya di berkas pengujian.
Tindakan Save/Test akan memanggil provider dan dapat menimbulkan biaya.

1. Pastikan sambungan n8n menunjukkan Tersimpan/Tersinkron/Teruji. Kunci REST
   laptop ini sudah disiapkan sebelumnya; buat/perbarui hanya jika kedaluwarsa
   atau ditolak. Token OAuth MCP bukan pengganti key REST backend.
2. Pada DeepSeek, buka pengaturan lanjutan: preset DeepSeek, URL
   `https://api.deepseek.com`, model `deepseek-flash`. Masukkan key sendiri lalu
   **Simpan dan sambungkan**. Model diverifikasi melalui daftar model provider.
   Nama saat ini mengikuti [dokumentasi resmi DeepSeek](https://api-docs.deepseek.com/);
   alias model lama tidak dipakai sebagai bukti versi model penelitian.
3. Konfigurasikan provider **Embeddings** secara terpisah: URL, key, model dan
   1536 dimensi yang sama persis dengan ingestion. Key DeepSeek saja belum
   mencukupi alur RAG sepenuhnya nyata. Jangan memakai vector hash mock sebagai embedding nyata.
4. Siapkan corpus pada lingkungan penelitian terpisah dari corpus dev. Ikuti
   [ingestion/README.md](../ingestion/README.md): tinjau izin sumber, manifest,
   split 80:20 per sumber/proyek sebelum chunking, lalu embed/load/verify dengan
   provider embedding yang benar. Jangan memuat dua representasi vector berbeda
   dengan nama model yang sama. Dataset Kaggle berstatus izin Unknown tetap
   membutuhkan tinjauan penulis. B9 tidak mengunduh atau mengesahkan dataset itu.
5. Klik **Uji sambungan** pada kedua provider dan **Terapkan ulang sambungan**.
   Diharapkan tiga indikator hijau per provider, workflow aktif dan Generate
   dapat dipakai. Jika model tidak ada, key ditolak, rate limit atau dimensi
   berbeda, perbaiki error itu dahulu; jangan mengubah flag penelitian untuk
   melewatinya.
6. Buat proyek uji berisi data yang memang boleh dikirim ke provider. Periksa
   empat bab selesai, requirement ID unik, sumber retrieval, flag/asumsi yang
   perlu dikonfirmasi, log durasi/token/model, edit manual dan revisi satu bagian.
   Terima satu revisi dan tolak yang lain; bagian lain harus tetap sama.
7. Finalisasi lalu unduh Word/PDF. Periksa isi, cover, TOC, tabel dan nomor halaman.
   Buat kasus evaluasi dengan baseline manusia yang asal/versi/bahasanya jelas.
   Jalankan penilaian ahli/SUS mengikuti protokol peserta dan unblinding.
8. Catat tanggal, model yang benar-benar dilayani, konfigurasi, input hash dan
   hasil observasi di catatan penelitian privat. Jika gagal, simpan kode error
   tanpa credential. Uji ini baru dapat diklaim berhasil setelah dilakukan.

Selama checkpoint saat ini, run tetap `is_thesis_run=false`. Enrollment run nyata
belum menjadi alur UI; evaluasi penelitian menolak mock/dev_seed. Keberhasilan
provider tidak otomatis membuat hasil layak dipakai sebagai temuan skripsi.
Untuk kembali ke mock, hapus kedua key provider dari penyimpanan lokal melalui
Settings, lalu jalankan `pnpm local:setup-mock` dan **Terapkan ulang sambungan**
pada lingkungan dev. Script menolak menimpa key/provider non-mock yang masih ada.

## Reproduksi tabel evaluasi

Contoh berikut seluruhnya sintetis. Jalankan dari root setelah layanan evaluator
siap:

```powershell
pnpm evaluation sus --input evaluation-scripts/examples/sus.json --output artifacts/sus.json
pnpm evaluation expert --input evaluation-scripts/examples/expert.json --output artifacts/expert.json
pnpm evaluation stats --input evaluation-scripts/examples/expert.json --output artifacts/stats.json
pnpm evaluation rouge --input evaluation-scripts/examples/rouge.json --output artifacts/rouge.json
pnpm evaluation export --scope dev --output artifacts/evaluation-dev
pnpm evaluation stats --input artifacts/evaluation-dev/snapshot.json --output artifacts/stats-current.json
```

Analisis snapshot memerlukan peserta/review lengkap yang cukup; suite membersihkan
jawabannya setelah selesai, sehingga snapshot dev kosong wajar menolak inferensi.
Untuk data penelitian, ganti scope hanya setelah run, corpus dan partisipan memang
memenuhi syarat. Precision/recall/F1, SUS, desain uji, Holm, effect size dan batas
CI dijelaskan di [B8-evaluation.md](B8-evaluation.md). JSON menyimpan versi engine,
seed dan input digest. Ekspor menggunakan pseudonim dan mengecualikan naskah serta
komentar bebas; tetap perlakukan sebagai data yang perlu dikendalikan.

## Batas checkpoint

Ini aplikasi local-owner satu laptop, bukan portal publik dengan akun responden
independen. Penilaian buta tidak menghalangi operator laptop membuka DB sendiri.
Selesaikan kasus sebelum unblinding. DOCX/PDF, transcript dan hasil analisis harus
ditinjau manusia. Browser menampilkan checkpoint AI sebelum materialisasi final;
persistensi pertama dapat menaikkan versi row AI, sementara isi checkpoint dan
edit manual dipertahankan. Provider/dataset/studi nyata dan dokumentasi final B10
belum dianggap selesai oleh acceptance mock B9.

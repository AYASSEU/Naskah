# Panduan menjalankan Naskah di Windows

Checkpoint B10, 11 November 2026. Panduan utama untuk laptop yang sudah
dikonfigurasi; bagian mesin baru menjelaskan dependensi yang belum otomatis.
Provider dan corpus checkpoint ini tetap mock/sintetis.

## Pull dan jalankan webapp dengan BERTScore

Pasang Node.js 24+ dan Docker Desktop dengan Linux containers. Dari folder proyek:

```powershell
git pull
npx.cmd --yes pnpm@11.25.0 dev
```

Tidak perlu menjalankan Docker atau evaluator secara terpisah. Startup memeriksa
dependency sesuai lockfile, menyalakan Docker Desktop bila engine belum berjalan,
menyiapkan container `naskah-evaluation`, dan menunggu health check sebelum
menjalankan webapp. Pertama kali, image beserta model diunduh/dibangun; tunggu
sampai URL webapp muncul. Internet dan ruang disk diperlukan untuk build pertama.
Pemakaian berikutnya menggunakan image lokal selama sumber evaluator tidak berubah.

Startup membuat URL dan token evaluator yang belum ada di `apps/web/.env.local`.
File ini tetap lokal dan tidak masuk Git. BERTScore dapat digunakan tanpa konfigurasi
database atau n8n. Pada clone baru, fitur lain memakai mode simulasi; konfigurasi
mode yang sudah ada tetap dipakai. Buka [BERTScore](http://127.0.0.1:3000/evaluation/bertscore)
untuk membandingkan PDF/TXT. Ctrl+C menghentikan webapp saja.

Jika Docker belum terpasang atau gagal dimulai, startup berhenti dengan petunjuk;
perbaiki status Docker Desktop lalu jalankan ulang perintah yang sama.

## Menjalankan setiap hari

Prasyarat: Docker Desktop dengan Linux containers, browser Edge/Chrome,
dependency proyek terpasang, Node.js 24+ dan pnpm 11.25.0. Script startup dapat
memakai runtime Codex terpasang bila `node.exe` tidak ada di PATH. Perintah
`pnpm`/`node` lain memerlukan PATH terminal yang sesuai.

```powershell
Set-Location -LiteralPath 'C:\Users\MSI1\OneDrive\文档\WebApp Skripsi'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode live
```

Tunggu pesan URL, lalu buka [webapp](http://127.0.0.1:3000). Tetap gunakan origin
ini selama bekerja; `localhost` dan `127.0.0.1` memiliki cookie/browser storage
terpisah. Biarkan terminal terbuka. Docker pertama kali menyiapkan image dapat
memerlukan internet; analisis dan acceptance memakai layanan lokal.

Startup menyalakan Docker bila perlu, Compose privat existing atau tiga container
n8n/runner/mock existing, Supabase, evaluator dan compiler. Ia tidak membuat
instance n8n baru dari nol, mengisi REST key, memuat corpus, atau reset volume.
Compiler memakai `--init` untuk memanen proses sisa LibreOffice. Script
mempertahankan server yang sudah mendengarkan port 3000, termasuk modenya.

| Layanan | Alamat | Pemeriksaan |
| --- | --- | --- |
| Naskah | http://127.0.0.1:3000 | Footer mode tersambung; Settings readiness |
| n8n 2.46.6 | http://127.0.0.1:5678 | `/healthz/readiness` |
| Mock AI/embedding | http://127.0.0.1:4010 | `/health`, respons `mock: true` |
| Supabase API | http://127.0.0.1:54321 | Doctor dan Storage/database checks |
| PostgreSQL / Studio | 127.0.0.1:54322 / http://127.0.0.1:54323 | Lokal, proyek `naskah` |
| Compiler/parser | http://127.0.0.1:8000 | `/health` |
| Evaluator Python | http://127.0.0.1:8010 | `/health` |

Di Settings, n8n dan kedua provider harus Tersimpan/Tersinkron/Teruji. Provider
mock memakai `http://host.docker.internal:4010/v1` dari container. Jangan mengganti
alamat itu dengan loopback container. Knowledge saat checkpoint: 150 `dev_seed`,
1536 dimensi; label model tidak menjadikan vector hash mock sebagai embedding nyata.

Di terminal kedua:

```powershell
node scripts/doctor.mjs
docker ps --format '{{.Names}}: {{.Status}}'
Invoke-WebRequest 'http://127.0.0.1:8000/health' -UseBasicParsing
Invoke-WebRequest 'http://127.0.0.1:8010/health' -UseBasicParsing
```

Doctor yang sehat mengembalikan `ready: true`, alasan kosong, tujuh workflow
aktif, dan `knowledge.devOnly: true` untuk konfigurasi mock ini. Doctor bukan
pengganti uji ekspor atau validasi kualitas AI. Jangan mencetak `.env.local`,
output status Supabase lengkap, atau hasil `docker inspect` tanpa pemilihan field.

## Berhenti, restart, dan ganti mode

Selesaikan atau batalkan pekerjaan lewat UI sebelum mematikan layanan.

1. Ctrl+C di terminal startup menghentikan **webapp saja**. Jika server berasal
   dari terminal lain, hentikan melalui terminal/proses Naskah yang Anda kenali.
2. Untuk menghentikan layanan proyek, sesudah web berhenti:

```powershell
docker stop naskah-compiler naskah-evaluation
docker stop n8n-local-runners n8n-local naskah-mock-llm
node scripts/local-database.mjs stop
```

Perintah tersebut mempertahankan data lokal. Jangan memakai `down -v`, reset
database, atau volume prune untuk restart biasa. Menutup jendela Docker Desktop
tidak selalu menghentikan engine. Menjalankan kembali perintah startup memulai
layanan yang sama. Jangan menutup Docker ketika pekerjaan masih berjalan.

Untuk browser mock Phase 1, hentikan web lama dahulu:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode mock -SkipN8n
```

Mode ini memakai IndexedDB dan fixture browser, dengan evaluator BERTScore lokal
otomatis disiapkan. Supabase/compiler tidak diperlukan. `-SkipN8n` tidak mematikan container yang sudah berjalan. Data
browser mock tidak otomatis dipindah ke database live. Mengganti mode tidak
mengganti key/model yang tersimpan pada backend.

## Dependency dan production build lokal

Jika pnpm tidak dikenali tetapi Node/npm terpasang:

```powershell
npx.cmd --yes pnpm@11.25.0 install --frozen-lockfile
```

Gunakan `pnpm.cmd` bila PowerShell memblokir `pnpm.ps1`, atau prefix
`npx.cmd --yes pnpm@11.25.0` untuk script lain. Tidak perlu mengubah kebijakan
PowerShell global. Jangan upgrade dependency sebagai langkah restart.

Untuk build, hentikan dev dahulu; layanan Docker boleh tetap berjalan:

```powershell
$env:NEXT_PUBLIC_DATA_MODE='live'
pnpm.cmd build
pnpm.cmd start
```

Mode publik dibekukan saat build. Build dan dev memakai output `.next` yang sama;
jangan jalankan bersamaan pada Windows/OneDrive. Ctrl+C lalu startup standar
mengembalikan dev server. Production build lokal belum berarti siap dipublikasikan.

## Mesin baru atau clone kosong

Clone Git **tidak mencakup** `.env.local`, database, Storage, key enkripsi,
Compose privat n8n, corpus maupun font privat. Webapp dengan BERTScore lokal dapat
langsung memakai alur pull/run di atas. Untuk backend live lengkap, script
`bootstrap.mjs` satu langkah yang disebut brief awal **belum tersedia**. Jalur pemulihan yang disarankan adalah
backup lengkap pada [runbook](runbook.md); startup harian bukan installer kosong.

Urutan penyiapan yang perlu dikerjakan operator pada mesin kosong:

1. Clone repo, pasang versi dependency terkunci dan Docker Desktop Linux.
2. Pulihkan atau provision Compose n8n/runner/mock privat; cocokkan image,
   loopback ports, runner auth dan key n8n. `infra/docker-compose.yml` adalah
   scaffold lama, bukan konfigurasi siap pakai laptop ini.
3. Jalankan `node scripts/local-database.mjs start`. Pada DB baru CLI menerapkan
   migration/seed; untuk DB existing, periksa history dan rencanakan migration
   tanpa reset. Wrapper dipin Supabase CLI 3.0.0, target lokal secara default.
4. **Hanya jika belum ada konfigurasi**, jalankan
   `node scripts/init-local-env.mjs` untuk nilai yang masih kosong. Jangan
   menggunakannya mengganti env/owner/key backup. Ia tidak menyediakan REST key n8n.
5. Buat REST key n8n dengan izin backend yang dijelaskan pada
   [checklist](real-api-checklist.md), masukkan secara privat di konfigurasi lokal,
   lalu restart web. Jangan menempelkan nilai key pada command line/chat.
6. Jalankan startup live, `pnpm local:setup-mock`, lalu **Terapkan ulang sambungan**
   di Settings atau `pnpm n8n:deploy`. Helper mock hanya menerima endpoint lokal
   4010 dengan key dummy dan menolak menimpa provider nyata.
7. Ikuti [ingestion dev seed](../ingestion/README.md) menggunakan
   `all --use-app-settings --require-mock`, lalu doctor dan acceptance lokal.

Ini prosedur penyiapan komponen, belum diuji sebagai instalasi satu klik dari
Windows kosong. Jangan menyalin key dari chat lama sebagai pengganti backup.

## Jika tidak bisa dibuka

| Gejala | Langkah berikutnya |
| --- | --- |
| Docker engine belum siap | Buka Docker Desktop, tunggu engine Linux sehat, ulang startup. Periksa disk/WSL melalui Docker. |
| Port 3000 terpakai | `Get-NetTCPConnection -LocalPort 3000 -State Listen`; periksa PID dengan `Get-Process -Id <PID>`, hentikan hanya server yang dikenali. |
| Footer masih simulasi | Hentikan web lama, jalankan `-Mode live`, reload. Startup tidak mengganti server existing. |
| Konfigurasi belum lengkap | Periksa **nama** field yang hilang dari error/doctor; pulihkan env privat yang cocok, jangan menimpa dengan file contoh kosong. |
| Settings 401/403 dari n8n | REST key kedaluwarsa atau scope kurang; perbarui sendiri, simpan, test, reapply. |
| Tersimpan tetapi belum tersinkron | Baca kode/langkah error, periksa n8n, nama/type credential, kemudian reapply; panduan recovery ada di runbook. |
| Knowledge kosong/model mismatch | Pastikan corpus dev dan konfigurasi embedding konsisten; jangan memuat vector nyata ke corpus mock. |
| PDF scan atau terenkripsi | Parser tidak menyediakan OCR/password unlock; berikan TXT/PDF bertulisan yang dapat diekstrak. |
| Ekspor gagal berulang | `pnpm local:compiler`, cek health dan Docker Init. Jangan hanya mengandalkan health sebagai bukti compile sukses. |
| Statistik menolak input | Periksa jumlah peserta, pasangan lengkap, desain dan scope; contoh sintetis tetap bisa dipakai untuk demonstrasi. |

Backup dan pemulihan volume/key, tes B9, serta langkah ke API asli:
[runbook](runbook.md), [checklist](real-api-checklist.md), [laporan B10](B10-handoff.md).

# Penyiapan lokal laptop, diperbarui 10 November 2026

Proyek tetap di `C:\Users\MSI1\OneDrive\文档\WebApp Skripsi`. Remote dan history Git
dipertahankan. Ini pemulihan lingkungan laptop tujuan, bukan pemulihan database
atau credentials dari komputer sumber.

## Yang berjalan

| Layanan         | Alamat                                | Keadaan terverifikasi                                                          |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| Naskah          | http://127.0.0.1:3000                 | Backend live lokal, provider mock, HTTP 200                                     |
| n8n 2.46.6      | http://localhost:5678                 | Healthy, existing volume `n8n_local_data`                                      |
| MCP n8n         | http://localhost:5678/mcp-server/http | Discovery, detail, eksekusi manual Hello World, dan hasil sukses terverifikasi |
| Mock provider   | http://localhost:4010/v1              | Container `naskah-mock-llm`, provider otomatis tanpa biaya                     |
| Supabase API    | http://127.0.0.1:54321                | Stack lokal `naskah`, migrasi dan seed yang ada                                |
| PostgreSQL      | 127.0.0.1:54322                       | Integrity/RLS checks untuk 27 tabel lulus                                      |
| Supabase Studio | http://127.0.0.1:54323                | Lokal                                                                          |

Korpus lokal memiliki 150 chunk `dev_seed`, model `text-embedding-3-small`, dimensi
1536, token perkiraan 386–426. Tidak ada duplikasi atau held-out yang tercampur.
Retrieval security dan specific_requirements lulus. Data ini sintetis dan **tidak
boleh menjadi metrik atau bukti hasil penelitian**. Tidak ada dataset penelitian
dari komputer lain yang diasumsikan sudah dipindahkan.

## Menjalankan kembali

Script akan mencoba menghidupkan engine Docker Desktop. Dari PowerShell di folder proyek:

```powershell
./scripts/start-local.ps1
```

Default B6 adalah backend **live lokal**, dengan provider tetap mock. Script
menjalankan Compose existing jika tersedia, atau memulai container existing saat
file Compose privat tidak ada. Volume/key dipertahankan. Supabase ikut dinyalakan
untuk mode live. Scaffold Compose lama di `infra/` tidak digunakan.
Untuk menjalankan ulang mode simulasi Phase 1:

```powershell
./scripts/start-local.ps1 -Mode mock
```

Dalam terminal Codex yang memiliki pnpm:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Dependensi proyek tidak diupgrade. pnpm 11.25.0 berasal dari runtime terpasang;
`npm`/`npx` tidak tersedia pada PATH sesi ini. Helper Supabase sekarang bisa
memakai entry JavaScript pnpm dari runtime tanpa melewati shell, dengan CLI
Supabase tetap dipin ke 3.0.0. Jalur standar npm/npx masih tersedia sebagai fallback.

Ctrl+C pada terminal startup menghentikan webapp. Untuk n8n dan mock provider:

```powershell
docker stop n8n-local-runners n8n-local naskah-mock-llm
```

Untuk Supabase gunakan helper dari Node yang tersedia pada terminal Codex:

```powershell
node scripts/local-database.mjs stop
```

Tidak ada perintah yang menghapus volume. Jangan menambahkan prune atau `down -v`.

## Konfigurasi backend lokal

`apps/web/.env.local` dibuat untuk laptop ini dan diabaikan Git. Nilai server
Supabase diperoleh dari CLI lokal. Encryption key aplikasi/owner lokal dibuat
baru karena belum ada database aplikasi lokal sebelumnya. Encryption key n8n
dan token webhook existing tetap digunakan.

Kunci awal verifikasi hanya memiliki workflow:list/read dan GET credentials
ditolak HTTP 403. Sesudah persetujuan eksplisit pengguna, key baru
`Naskah local backend` dibuat untuk 30 hari (berakhir 9 Desember 2026) dengan:

- credential:list/read/create/update/delete;
- workflow:list/read/create/update/activate/deactivate;
- execution:list/read/stop.

Key baru sudah disimpan lokal pada environment pengguna Windows, `.env.local`,
dan store Settings terenkripsi. GET workflows/credentials, pembuatan/PATCH
credential, serta deploy/aktivasi workflow sudah berhasil. Environment pengguna
dan `.env.local` bukan sumber yang otomatis selalu sinkron. Saat mengganti key,
perbarui keduanya serta Sambungan n8n di Settings. Hak OAuth MCP tetap
workflow:read, workflow:execute, execution:read. Jangan tempelkan key ke chat.

Pemulihan koneksi lokal dapat dijalankan ulang dengan:

```powershell
pnpm.cmd local:setup-mock
```

Perintah ini hanya memakai mock provider pada port 4010, menolak konfigurasi
provider nyata, menyimpan key dengan envelope terenkripsi, dan mengadopsi
credential transfer dengan nama/type unik. Tiga ID credential transfer, ID dan
posisi node, grup, serta visibilitas MCP sudah diverifikasi tetap sama. Lima nama
credential yang diperlukan kini unik; kedua webhook provider lulus pengujian.

B6 sudah menyambungkan Generate SRS, Revisi AI, penyimpanan dan history ke n8n
serta Supabase lokal. `NEXT_PUBLIC_DATA_MODE=live` berarti backend/persistensi
nyata; provider tetap mock. Parser/kompiler server dan evaluasi penelitian masih
mengikuti B7–B10. Helper browser untuk parsing dan Word/print tetap digunakan.
Gunakan key provider nyata hanya pada pengujian manual; tes otomatis selalu mock.

## Alur UI B6

Lihat [B6-local-ui.md](B6-local-ui.md) untuk penggunaan, endpoint, SSE/reconnect,
accept/reject revisi, autosave/version conflict, cancel/resume dan batas fase.
Pengujian backend UI dapat diulang dengan `pnpm.cmd test:b6`; laporan lokal ada
di `artifacts/b6-acceptance.json`. Entri contoh membuat draft kosong dari input
sintetis, bukan mengimpor hasil AI fixture sebagai dokumen live.

## Kemajuan B5

`packages/core` menjadi sumber tunggal parser requirement, template IEEE,
penilaian struktur, renderer manuscript, dan pemeriksaan numeric rewrite.
Tiga fixture Phase 1 dipertahankan sebagai golden manuscripts. UI tetap memakai
ports dan desain Phase 1. Perakitan mock tidak lagi mengulang heading bab.

```powershell
pnpm.cmd n8n:build
```

Build menghasilkan `n8n/schemas/chapter-draft.json` dari schema Zod dan workflow
`Naskah / Smoke / Markdown` dengan renderer/validator kecil yang mandiri. Graph
dan parameter diperiksa melalui katalog node live dan validator MCP. Tidak ada
credential ID atau nilai rahasia di artefak Git.

Pengujian ulang webhook kontrak:

```powershell
pnpm.cmd n8n:verify-markdown
```

Script menolak nama workflow/credential ambigu, mempertahankan node IDs dan grup
saat update, melakukan upsert dan publikasi, lalu menguji webhook production
terautentikasi dengan fixture sintetis. Hasil harus byte-identical dengan Node
renderer. Ini hanya smoke kontrak Markdown, bukan workflow Generate SRS.
Pengujian nyata sudah lulus untuk empat fixture (18.952; 9.821; 2.592; dan 292
byte), termasuk field requirement terstruktur; token yang salah ditolak. Laporan
tanpa rahasia ada di `artifacts/n8n-markdown-verification.json` (diabaikan Git).
Runner n8n memblokir Object.defineProperty: bundle menggunakan container hasil
lokal biasa, bukan getter ekspor bundler, tanpa melonggarkan sandbox.

## Workflow B5

```powershell
pnpm.cmd n8n:build
pnpm.cmd n8n:deploy
pnpm.cmd test:b5
```

Build sekarang juga menghasilkan ketiga workflow utama dan smoke Supabase.
Deploy menggunakan sambungan n8n terenkripsi dari Settings, mengikat credential
berdasarkan nama/type, mengaktifkan workflow, serta memeriksa error routing.
**Terapkan ulang** di Settings memakai fungsi deploy yang sama setelah smoke
provider berhasil. ID, posisi node, grup, serta visibilitas MCP dipertahankan.

Tes hanya mengizinkan mock provider lokal pada port 4010 dengan key dummy.
Webapp harus berjalan pada port 3000 agar callback nyata dapat diterima. Laporan
per kasus ada di `artifacts/b5-acceptance.json`, diabaikan Git. Proyek uji berlabel
`B5 synthetic` dan bukan data penelitian. Rincian arsitektur, error, retry,
checkpoint/resume, dan batas fase berikutnya ada di [B5-workflows.md](B5-workflows.md).

## Pemeriksaan

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
pnpm.cmd audit:slop
pnpm.cmd check:contrast
node scripts/test-database.mjs
```

Hasil dan status fase dicatat di `docs/backend-phase-reports.md`. Backup n8n dan
prosedur rollback tetap berada di `%LOCALAPPDATA%\n8n-docker` dan
`%LOCALAPPDATA%\n8n-backups`, di luar Git dan sinkronisasi OneDrive.

## B7 parser dan ekspor server

Start-local -Mode live kini menyalakan container naskah-compiler pada
127.0.0.1:8000. Parser PDF/TXT dipakai dari formulir proyek; Word dan PDF asli
diunduh setelah finalisasi. Provider tetap mock. Token layanan dan font Windows
disiapkan otomatis secara lokal. Petunjuk operasi, fallback COMPILER_MODE=client,
batas unggahan, serta pengujian: [B7-documents.md](B7-documents.md).

## B8 evaluasi lokal

Start-local -Mode live juga menyalakan naskah-evaluation di 127.0.0.1:8010,
dengan token server-only yang dibuat otomatis. Buka /evaluation untuk persetujuan
peserta, penilaian ahli A/B, SUS, ROUGE, statistik dan ekspor JSON/CSV. Data uji
dan penelitian terpisah; mock tidak memenuhi syarat penelitian. Perintah Python,
backup input privat, batas dan asumsi: [B8-evaluation.md](B8-evaluation.md).

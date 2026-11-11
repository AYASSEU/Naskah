# Runbook operasi dan pemulihan Naskah

Checkpoint B10 — 11 November 2026. Operasi saat ini: satu pemilik, backend lokal,
dua provider mock, corpus `dev_seed`. [Panduan Windows](local-laptop-setup.md)
memuat startup/stop/prasyarat; [checklist API asli](real-api-checklist.md) memuat
langkah pengguna yang belum dilakukan. Semua perintah dijalankan dari root repo.

## Operasi harian

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode live
```

Buka http://127.0.0.1:3000. Di terminal lain, `node scripts/doctor.mjs` harus
menunjukkan backend siap. Periksa health compiler/evaluator pada port 8000/8010
dan indikator Settings. Selesaikan/batalkan job sebelum stop/restart; Ctrl+C
menghentikan web saja. Hindari sleep laptop ketika job sedang berjalan.

Sebelum mengubah konfigurasi, simpan backup konsisten. Setelah perubahan:
restart web untuk env yang di-cache, simpan/test koneksi, reapply workflow dan
generate/revise/export satu proyek dev. Jangan gunakan data penelitian untuk
smoke. Catat commit, waktu, versi image, model dan hasil tanpa key.

## Backup lengkap

Git, file DOCX/PDF, dan ekspor evaluasi **tidak menggantikan backup sistem**.
Gunakan folder terenkripsi dengan akses Windows terbatas, di luar repo/OneDrive.
Folder `%LOCALAPPDATA%\n8n-backups` yang sudah ada berisi backup historis;
keberadaannya tidak menjamin snapshot mencakup perubahan terbaru.

| Komponen | Yang perlu disimpan bersama snapshot |
| --- | --- |
| Repo | Commit/working changes, lockfile, migration, workflow/prompt portable; repo tetap tidak berisi key |
| Aplikasi | `apps/web/.env.local`, terutama `APP_ENCRYPTION_KEY`, `APP_KEY_VERSION`, `LOCAL_OWNER_ID`, callback/webhook secret, konfigurasi DB |
| n8n | Seluruh volume `n8n_local_data` di `/home/node/.n8n`, SQLite/config/binary data, Compose/env privat `%LOCALAPPDATA%\n8n-docker`, key n8n yang sesuai |
| Supabase | Volume `supabase_db_naskah` dan `supabase_storage_naskah`, config CLI/project; metadata DB dan berkas Storage harus satu checkpoint |
| Runtime | `%LOCALAPPDATA%\naskah-runtime`: token layanan/font privat yang perlu dipertahankan; log hanya jika dibutuhkan untuk investigasi |
| Penelitian | Raw/derived corpus, manifest/split/cache, baseline, consent/protokol, input analisis dan hasil privat dengan provenance |

Prosedur cold backup yang disarankan:

1. Hentikan input baru, tunggu job selesai/batalkan lewat UI. Hentikan web,
   compiler/evaluator, n8n/runner/mock. Hentikan seluruh container Supabase proyek
   `naskah` melalui Docker Desktop agar DB dan Storage tidak ditulis. Jangan
   menghapus container/volume; jangan salin SQLite/PGDATA saat masih ditulis.
2. Catat versi/digest image dan pemetaan volume. Perintah baca yang tidak
   menampilkan environment/key:

```powershell
docker inspect --format '{{.Name}} {{.Config.Image}} {{.Image}}' n8n-local supabase_db_naskah supabase_storage_naskah
docker inspect --format '{{.Name}} {{range .Mounts}}{{.Name}} -> {{.Destination}} {{end}}' n8n-local supabase_db_naskah supabase_storage_naskah
```

3. Sign in Docker Desktop, buka Volumes → volume → Exports → Quick export →
   **Local file**. Ekspor ketiga named volume ke folder backup privat, bukan Hub
   atau cloud. Pastikan seluruh writer tetap berhenti sampai semua ekspor selesai;
   Docker dapat me-restart container yang dihentikannya sendiri. Jika nama/mount berbeda, gunakan hasil
   inspeksi, bukan asumsi nama di tabel. Simpan salinan env/config/corpus di sana;
   jangan menampilkan isi key saat menyalin. Simpan checksum dan waktu snapshot.
4. Simpan key pemulihan melalui password manager/media privat yang dapat diakses
   ketika laptop rusak. Jaga backup berisi data dan key sebagai bahan sensitif.
5. Jalankan startup lagi dan periksa readiness serta satu ekspor dokumen.

Restore: gunakan **salinan** volume pada lingkungan uji terisolasi dengan image
yang cocok, pulihkan env/owner/key dari checkpoint yang sama, DB **dan** Storage,
kemudian hubungkan kembali n8n. Verifikasi dekripsi Settings, jumlah/versi proyek,
riwayat, retrieval, download artefak lama, compile baru, dan ekspor evaluasi.
Jangan menjalankan salinan pada port/volume aktif atau menimpa volume satu-satunya.
Untuk PGDATA fisik, versi mayor PostgreSQL/image harus cocok; upgrade mayor perlu
prosedur migrasi tersendiri. Pertahankan backup asli sampai restore diterima.

Full cold-volume restore ini **belum didrill pada B10**. Recovery credential B9
di bawah sudah diuji; itu tidak memulihkan seluruh database/history n8n. Rujukan:
[backup n8n](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/backup-and-restore.md),
[Docker Desktop volumes](https://docs.docker.com/desktop/use-desktop/volumes/).

## n8n kehilangan credential atau volume

Jika hanya credential Naskah hilang tetapi DB aplikasi/encryption key masih ada:

1. Pastikan REST key n8n masih valid dan izin cukup. Jangan membuat credential
   manual dengan nama duplikat. Settings menyimpan provider key terenkripsi.
2. Buka Settings → **Terapkan ulang sambungan**. Sistem menyiapkan semua credential
   yang hilang sebelum memperbarui workflow, mengikat nama **dan type** kanonis,
   lalu publish dan smoke. Nama ambigu/incomplete binding akan diblokir.
3. Periksa tujuh workflow aktif, tiga indikator tiap koneksi, lalu Generate dan
   Revise proyek dev. B9 membuktikan recovery kelima credential milik Naskah;
   credential/workflow asing tidak dihapus.

Jika seluruh volume n8n hilang:

1. Utamakan restore full volume/config dengan key n8n lama dan image yang cocok.
   Ini diperlukan untuk history, akun dan workflow non-Naskah.
2. Bila tidak ada backup, provision instance n8n kosong secara terpisah, buat akun
   pemilik dan REST key baru. Masukkan key sendiri di Settings n8n; pertahankan
   DB aplikasi, `LOCAL_OWNER_ID` dan `APP_ENCRYPTION_KEY` lama.
3. Build workflow dari repo dan deploy/reapply, dengan kedua provider mock tetap
   tersimpan. Hindari import transfer lama yang menyematkan ID laptop lain.

```powershell
pnpm n8n:build
pnpm n8n:deploy
node scripts/doctor.mjs
```

4. Pastikan URL internal `host.docker.internal`, auth inbound/callback dan
   Supabase credential sesuai env. Tujuh workflow harus aktif; lanjut uji dev.

Rebuild ini memulihkan workflow/credential Naskah dari DB aplikasi yang utuh,
bukan history eksekusi/akun/workflow lain. Kehilangan DB aplikasi atau application
key membutuhkan backup yang cocok atau memasukkan ulang key milik pengguna.
Mengubah `N8N_ENCRYPTION_KEY` saja tidak mendekripsi credential lama. Key aplikasi
dan key n8n adalah dua hal berbeda. [Penjelasan resmi key n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/set-a-custom-encryption-key.md).

## Rotasi key: bedakan tiga jenis

**API key provider/REST:** buat pengganti di layanan terkait, masukkan melalui
Settings, Save/Test/Reapply. Verifikasi permintaan dev memakai credential baru,
baru cabut key lama. Implementasi mencoba PATCH → PUT → staged recreate/rebind
hanya ketika metode tidak didukung; kegagalan auth/network tidak memicu fallback.
PATCH telah diuji pada n8n lokal 2.46.6. Jangan hapus semua credential untuk rotasi.

**APP_ENCRYPTION_KEY:** implementasi saat ini hanya membaca satu pasangan
`APP_KEY_VERSION`/key aktif, belum memiliki command migrasi rotasi. **Jangan hanya
mengubah env atau menaikkan versi**: envelope lama tidak dapat dibuka. Prosedur
maintenance yang harus diimplementasikan/diuji sebelum rotasi data existing:

1. Cold backup DB/env/key dengan checkpoint yang sama; hentikan web dan ingestion.
2. Pada salinan DB, helper privat membaca key lama/baru tanpa log/argumen CLI.
   Dekripsi **semua** `integration_secrets` dengan versi lama dan associated data
   `[provider, owner_id]`; seal ulang dengan nonce baru dan versi baru menggunakan
   `security/envelope.ts`. Ganti ciphertext/iv/tag/version dalam satu transaksi.
   Jangan mengekspor plaintext key ke file/terminal.
3. Verifikasi setiap row dapat didekripsi dan field config/owner tetap sama,
   lalu pindahkan env key/version secara konsisten ketika tidak ada writer.
   Uji Settings, n8n smoke dan Python ingestion dengan vector envelope bersama.
4. Key ini juga menandatangani cookie dan pseudonim HMAC ekspor. Rotasi
   menginvalidasi sesi owner/peserta dan mengubah pseudonim ekspor; rencanakan
   di luar periode studi, arsipkan snapshot/provenance sebelumnya.
5. Baru terapkan maintenance yang telah lulus di lingkungan utama. Jika gagal,
   rollback DB **dan env/key** bersama; jangan meninggalkan campuran versi.

Langkah ini adalah runbook maintenance, **bukan fitur rotasi otomatis yang sudah
lulus acceptance**. Untuk instance baru kosong, key boleh dibuat baru; itu bukan
migrasi credential existing. Jangan mengganti owner ID sebagai cara memperbaiki
dekripsi karena owner terikat dalam envelope.

**N8N_ENCRYPTION_KEY:** pertahankan key existing saat recreate/restore. Rotasi
membutuhkan migrasi credential sesuai versi n8n dan drill terpisah; backup full
volume/key dahulu. Jangan memakai export credential plaintext ke repo atau
terminal. Rotasi n8n key tidak dilakukan pada checkpoint ini.

## Model embedding baru / re-embedding

Schema retrieval saat ini `vector(1536)`. Mengganti nama/model tidak mengubah
vector lama dan nilai dimensi sama belum menjamin ruang embedding sama.

1. Bekukan manifest/split per dokumen/proyek; simpan model/provider/dimensi dan
   hash input lama. Backup. Siapkan lingkungan/corpus baru, jangan campur ke dev.
2. Konfigurasikan embedding provider baru di Settings dan smoke. Jika dimensi
   bukan 1536, diperlukan migration schema/RPC/index/validasi dan tes; UI saat
   ini menolak dimensi lain, bukan konversi otomatis.
3. Buat direktori output ingestion baru; fetch/split/chunk yang telah ditinjau,
   lalu `embed`, `load`, `verify` dengan koneksi dan dimensi yang sama. Jangan
   memakai cache vector lama untuk model baru. Ikuti [ingestion](../ingestion/README.md).
4. Periksa train/held-out tidak bocor, count/hash/provenance, model/dimensi,
   retrieval domain/section dan hasil smoke. Alihkan query dan corpus bersama
   sesudah verifikasi; rollback mengembalikan koneksi **beserta** corpus lama.
5. Catat identitas versi model yang benar-benar dilayani. Re-embedding nyata
   dapat berbiaya dan belum dijalankan. Mock hash vector tidak dapat dipakai
   untuk menilai retrieval/kualitas penelitian.

## Provider atau template baru

Provider OpenAI-compatible dapat diuji melalui preset custom/base URL/model
existing. Provider dengan protokol lain memerlukan varian workflow dan validasi
server. Untuk menambah **jenis integrasi baru**, enum/schema `IntegrationId`,
registry server, label/UI dan tes perlu diperbarui; belum cukup satu registry
entry. UI sudah merender daftar integrasi, tetapi kontrak masih enum terbatas.
Jangan ubah sync engine untuk menaruh secret dalam workflow JSON. Verifikasi
URL/SSRF, `/models`, request/response schema, credential type, error/retry dan
smoke lokal sebelum mencoba key asli. Build/deploy lalu jalankan tes regresi.

Template aktif adalah data di `app_config` (`template:<id>`), prompt di
`prompt_templates`; default murni ada di `packages/core/src/template.ts`.
Untuk varian seperti ISO/IEC/IEEE 29148:

1. Tentukan struktur dan persyaratan dari salinan standar yang boleh digunakan;
   jangan klaim kepatuhan hanya dari mengganti judul template.
2. Tambahkan ID/versi/template tervalidasi dan prompt setiap bab melalui migration
   data baru; jangan menimpa template yang sedang dipakai dokumen existing.
3. Perbarui katalog/pemilih template UI yang saat ini berfokus IEEE 830, mapping
   section retrieval dan asumsi compiler bila perlu. Jangan mengganti ID dokumen
   lama secara massal. Grammar/parser dan golden harus tetap konsisten.
4. Uji Generate/Revise isolasi, structure completeness, Markdown round trip dan
   layout semua halaman Word/PDF. Build/deploy jika kode/prompt bundle berubah.

Penambahan provider/standar baru belum dilakukan B10; ini titik ekstensi beserta
pekerjaan yang diperlukan, bukan janji konfigurasi tanpa kode.

## Acceptance dan pemulihan pengujian

Dengan web live dan dua provider mock siap, jalankan **sendiri**, tanpa tes lain
yang mengubah Settings/mock controller/evaluasi:

```powershell
pnpm test:b9
pnpm scan:secrets
```

Report: `artifacts/b9/acceptance.json`. B9 mencakup Generate/reconnect/resume,
edit, accept/reject revisi, ekspor server, evaluasi, key create/rotation/recovery,
parser soak dan lifecycle compiler. Ia memakai data sintetis dan backup Settings
encrypted, lalu restore/cleanup. Mock UI lama diuji terpisah:

```powershell
# Web harus dijalankan ulang dalam -Mode mock terlebih dahulu.
$env:NASKAH_E2E_MODE='mock'
pnpm test:e2e tests/e2e/flows.spec.ts tests/e2e/ai-settings.spec.ts
Remove-Item Env:\NASKAH_E2E_MODE
```

Jika B9 terputus sebelum restore, pertahankan env/key dan snapshot privat di
`%LOCALAPPDATA%\naskah-runtime\b9-integrations-backup.json`. Jangan ubah Settings.

```powershell
$env:TSX_TSCONFIG_PATH='apps/web/tsconfig.json'
node --conditions=react-server --env-file=apps/web/.env.local --import tsx scripts/b9-runtime.ts restore
node --conditions=react-server --env-file=apps/web/.env.local --import tsx scripts/b9-runtime.ts cleanup
```

Restore memverifikasi owner, cleanup hanya ID sintetis dalam manifest. Snapshot
dibuang sesudah pemulihan berhasil. Jangan memanggil `preflight` sebagai health
check; ia membuat recovery snapshot. Jangan menaruh snapshot/log/trace/cookie di
Git. Trace browser default mati; opt-in `NASKAH_E2E_TRACE=1` hanya debugging privat.

## Evaluasi dan batas operasi

Perintah untuk tabel/gambar BAB IV, scope dan pseudonim:
[thesis-data-guide.md](thesis-data-guide.md). Metode/limit numerik:
[B8-evaluation.md](B8-evaluation.md). Semua contoh acceptance adalah dev.

Aplikasi masih local-owner satu laptop. Cookie peserta bukan akun portal publik;
pemulihan peserta setelah cookie kedaluwarsa belum tersedia. Operator dapat
melihat DB/mapping sehingga blinding memiliki batas. Enrollment run penelitian
nyata belum menjadi UI dan harus diselesaikan sebelum studi. Provider nyata,
full-volume disaster restore dan rotasi encryption key belum diuji pada B10.

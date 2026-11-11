# B10 — dokumentasi final dan serah terima lokal

11 November 2026. Scope: menyelaraskan dokumentasi dengan implementasi B0–B9,
menyiapkan panduan Windows/operasi/data penelitian dan daftar pekerjaan pengguna.
Backend, schema, workflow, provider settings, key dan corpus tidak diganti B10.
Layanan tetap lokal dengan provider mock; tidak ada push atau panggilan API asli.

## Dokumen yang menjadi acuan

| Kebutuhan | Dokumen |
| --- | --- |
| Mulai cepat, mode dan status saat ini | [README](../README.md) |
| Windows: startup/stop/restart, dependency, build, masalah umum/mesin baru | [local-laptop-setup.md](local-laptop-setup.md) |
| Backup/restore, credential/volume n8n hilang, rotasi key, re-embedding, provider/template baru | [runbook.md](runbook.md) |
| Tiga tugas pengguna dan smoke provider nyata | [real-api-checklist.md](real-api-checklist.md) |
| Boundary/schema/auth, amendment dan legacy routes | [contracts.md](contracts.md), [markdown-contract.md](markdown-contract.md) |
| Aliran dan pemisahan penyimpanan live/mock | [architecture.md](architecture.md) |
| Seluruh FR, RQ dan bukti backend/test | [traceability.md](traceability.md) |
| Asal setiap calon tabel/gambar BAB IV, scope, perintah evaluasi dan pseudonim | [thesis-data-guide.md](thesis-data-guide.md) |

Roadmap/Phase 1 dipertahankan sebagai sejarah dengan penunjuk status B10.
README n8n tidak lagi menyatakan workflow inert. Contoh env tidak lagi mengarah
ke perintah bootstrap yang tidak tersedia. Brief asli tetap dokumen permintaan,
bukan laporan fitur yang otomatis sudah selesai.

## Kondisi dan bukti

Saat B10, doctor lokal melaporkan `ready: true`, tujuh workflow aktif, 150 chunk
`dev_seed` dengan 1536 dimensi. Web memakai HTTP adapters live; kedua provider
tetap endpoint mock port 4010. Compiler/evaluator healthy, compiler Docker Init
aktif, scope research kosong. Tidak ada data sintetis yang dipromosikan.

Baseline B9 (`3704989`): 14 live UI dan 20 mock UI (terpisah), 99 unit tests,
26 B5 webhook, 10 B6 HTTP, 6 B7 document groups, 7 B8 evaluation groups, 19 Python
numerical tests, 29 tabel integrity/anon denial. Typecheck/lint/build/design
audit/26 contrast pairs lulus. Tiga puluh compile berturut-turut tanpa zombie;
parser soak 200 measured calls. Security/performance advisors tanpa warn/error.
Tiga warning SQL lint text→jsonb B5 existing tetap tercatat; jangan menyatakan
seluruh SQL lint bebas warning. Rincian: [B9](B9-end-to-end.md).

B10 mengubah dokumentasi dan komentar env saja. Validasi dokumentasi memeriksa
17 berkas, 92 tautan relatif, 52 referensi script pnpm, 39 referensi schema,
sembilan FR dan 25 blok PowerShell tanpa error sintaks. Contoh SUS, ahli,
statistik dan ROUGE berjalan di evaluator lokal; ekspor dev API berhasil.
Doctor/health mengonfirmasi kondisi di atas. Laporan tanpa secret disimpan pada
`artifacts/b10/` yang diabaikan Git. Full suite B9/build
tidak perlu diulang untuk perubahan dokumentasi ini. Backup full volume,
rotasi encryption key, provision mesin kosong, dan smoke provider asli tidak
dijalankan sebagai bagian B10.

## Deviasi dan pekerjaan yang masih terbuka

| Area brief | Implementasi / alasan / batas yang sebenarnya |
| --- | --- |
| Model DeepSeek-V4-Flash | Default `deepseek-flash` mengikuti dokumentasi provider yang diperiksa saat B9; alias lama bukan versi penelitian beku. Verifikasi lagi saat memakai key asli; simpan returned model. |
| Embedding | Integrasi kompatibel terpisah, default `text-embedding-3-small`/1536. Saat ini endpoint lokal menghasilkan hash vector mock. Belum ada embedding/model retrieval nyata yang tervalidasi. |
| Update credential | PATCH tersedia dan telah diuji; PUT/staged recreate/rebind untuk metode tak didukung. B9 menyiapkan semua credential hilang sebelum update active workflow yang dapat auto-publish. Bukan selalu delete/create. |
| Akuisisi dataset | B4 memperoleh PURE/PROMISE untuk persiapan dan split provisional, 112 grup awal/22 held-out; chunking gagal pada 16 oversize documents sehingga belum ada research embedding. Kaggle license Unknown menunggu tinjauan penulis. Tidak ada ingestion nyata baru B9/B10. |
| Flow/node n8n | Durable single-item stage loop; planner bundle lebih besar daripada konvensi Code node kecil pada brief untuk menjaga checkpoint/retry/resume. Source modular/shared core dan runner tests dipertahankan. |
| Template/compiler | Cover literal lewat python-docx; Lua captions; Pandoc reader sandbox, writer menggunakan AST tervalidasi karena keterbatasan Pandoc 2.17. Dua worker lokal, bukan queue durable terdistribusi. |
| Semua Phase 1 tests pada live | Fixture-specific suite diuji dalam mock; live counterparts menguji persistence/transport/output server yang sebenarnya. Kedua tema dan seluruh chain tercakup. |
| Satu command bootstrap | `scripts/bootstrap.mjs`/`backend:bootstrap` belum tersedia. Startup mengadopsi lingkungan existing; instalasi kosong masih komponen/manual dan belum diuji satu klik. |
| Rotasi encryption key | Envelope berversi, tetapi hanya satu key aktif yang dibaca. Belum ada migration helper/key-ring otomatis; runbook memberi prosedur maintenance yang perlu diuji, bukan mengganti env saja. |
| Tambah provider satu entry | Custom compatible endpoint bisa memakai integrasi existing; jenis baru masih membutuhkan enum/schema/label/varian workflow dan tes. Tidak cukup registry entry saja. |
| Data dan tabel penelitian | Scope/guards/analisis/ekspor tersedia, enrollment thesis run belum menjadi UI. Tidak ada responden/studi nyata atau temuan BAB IV. Generator figure publikasi otomatis belum tersedia; input/rumus/sumber grafik dijelaskan. |
| Auth/deployment | Satu local-owner, bukan login responden publik. Operator bisa membaca DB; sesi peserta 7 hari tanpa recovery kode. Full-volume restore dan key rotation belum didrill. |

Ini berarti **dokumentasi B10 selesai**, bukan seluruh definisi done pada brief
termasuk bootstrap/studi/provider nyata telah dipenuhi. Batas historis per fase
tetap dapat ditelusuri di [laporan backend](backend-phase-reports.md).

## Tiga tugas pengguna berikutnya

1. REST key n8n sudah siap; ganti bila expired/ditolak, dengan izin backend yang
   cukup. Jangan memakai OAuth MCP sebagai pengganti REST key.
2. Masukkan key DeepSeek dan embedding sendiri di Settings, ikuti smoke manual
   dan tinjau hasil; konfigurasi B10 masih mock.
3. Sahkan sumber/izin serta corpus nyata, selesaikan ingestion dan enrollment/
   protokol studi sebelum memakai data untuk skripsi. Jangan campur dengan dev_seed.

Perintah startup Windows ada di [README](../README.md); perintah untuk SUS, ahli,
statistik, ROUGE, struktur dan export ada di [panduan BAB IV](thesis-data-guide.md).

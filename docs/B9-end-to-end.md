# B9 — acceptance lokal menyeluruh

Pengujian memakai Supabase dan n8n lokal, provider LLM/embedding mock dan data
sintetis. Mode browser adalah `live`. Uji provider asli tetap menunggu pengguna
sesuai batasan fase ini; langkahnya ada di [runbook.md](runbook.md).

## Cakupan

`live-system.spec.ts` menguji dua sumber input di kedua tema: teks dan PDF/TXT
dengan gagal pada bab kedua lalu resume. Setiap kasus meneruskan proyek yang sama
melalui edit manual, revisi accept/reject, finalisasi, unduhan Word/PDF, kasus
baseline, dua pakar, dua SUS, statistik, ROUGE dan ekspor pseudonim. Tidak ada
penggantian naskah dengan fixture evaluasi terpisah di tengah alur.

Progres SSE diputus setelah event dengan cursor positif; browser wajib menyambung
kembali dengan Last-Event-ID. Resume mempertahankan isi/guardrail bab yang selesai
dan seluruh versi/timestamp edit manual. Versi row AI dapat naik saat persistensi
pertama dari checkpoint virtual ke dokumen final; itu bukan regenerasi bab.
Jumlah panggilan bab pertama tetap satu. Revisi yang ditolak tidak mengubah
dokumen; yang diterima hanya mengubah target. Word XML dan teks PDF sebenarnya
harus memuat edit serta revisi yang diterima. Semua tab evaluasi diperiksa pada
lebar 390 px tanpa horizontal overflow halaman; tabel boleh digulir di dalam
kontainernya.

`live-settings.spec.ts` menguji simpan credential baru, rotasi, penolakan key
invalid sebelum penyimpanan, hapus dan blokir Generate, penghapusan hanya lima
credential milik Naskah, serta pemulihan melalui UI. Tiga generation per tema
memverifikasi hash key yang benar-benar diterima mock. Credential lain dan volume
n8n dipertahankan. Identitas/posisi node workflow dipertahankan. Setting semula
dipulihkan dari snapshot encrypted yang tersimpan di runtime lokal.

Suite live B6/B7/B8 tetap dijalankan sebagai regresi; suite fixture browser-only
Phase 1 dipilih pada mode mock tersendiri. Memaksakan UUID IndexedDB, teks fixture
dan key dalam memori Phase 1 sebagai assertion atas database live tidak valid.
Pemilihan suite kini eksplisit, dengan counterpart live untuk fitur yang sama.

## Perbaikan yang ditemukan

1. **Credential baru setelah delete belum dipakai workflow utama.** Database
   binding lama ikut terhapus, sehingga sinkronisasi sebelumnya hanya mengganti
   smoke workflow. Pemulihan sekarang mencocokkan nama canonical dan tipe
   credential dalam workflow milik Naskah, sebelum menyatakan sync selesai.
2. **Pemulihan beberapa credential gagal pada workflow aktif.** Instance n8n
   mempublikasikan PUT workflow aktif dan menolak sibling credential yang masih
   merujuk ID terhapus. Bootstrap kini membuat seluruh credential yang hilang
   terlebih dahulu; rebind memperbaiki seluruh sibling reference canonical
   bertipe cocok dalam satu update. Referensi tidak lengkap/ambigu ditolak.
   Workflow lain dan credential berbeda nama/tipe tidak disentuh.
3. **Toolbar evaluasi melampaui viewport ponsel.** Kontrol compute/import memakai
   flex tanpa batas lebar input file. Toolbar kini membungkus; input file dan
   label mengikuti lebar kontainer, sedangkan tabel tetap digulir internal.
4. **Intake selalu berlabel simulasi.** Label kini mengikuti mode adapter; backend
   tersambung tidak lagi disebut browser-only simulation. Provider aktif tetap
   dapat diperiksa di Settings.

5. **Proses sisa LibreOffice memenuhi batas PID setelah pemakaian berulang.**
   Container lama mengumpulkan lebih dari 100 zombie process, lalu ekspor dan
   parser gagal meski health masih menjawab. Startup kini memakai Docker
   `--init` agar child yatim dipanen, dengan fingerprint runtime yang memigrasikan
   container lama. Verifikasi 30 kompilasi beruntun memerlukan zero zombie dan
   jumlah proses idle yang terbatas. Batas PID tetap 128. Penanganan init mengikuti [Docker container run](https://docs.docker.com/reference/cli/docker/container/run/#specify-an-init-process).

Sampling soak parser juga menunggu cleanup idle secara bounded, sehingga tidak
menganggap selang cleanup setelah HTTP selesai sebagai kebocoran.

Tidak ada migration/schema baru B9. Pengujian menolak provider non-mock dan
menyimpan manifest ID sintetis untuk cleanup owner-scoped. Tidak ada endpoint
debug, penghapusan volume, promosi data dev menjadi penelitian atau push Git.

## Pemetaan fungsional

| ID | Route | Workflow/layanan | Pengujian |
| --- | --- | --- | --- |
| FR-IN-01 | `/new-project`, `/workspace/[id]` | Generate SRS, Supabase | live-system text/PDF; B5/B6 |
| FR-IN-02 | `/new-project` | `/api/parse-pdf`, parser lokal | live-system PDF; server-parser; B7 |
| FR-IN-03 | `/new-project` | shared cleaning + parser | server-parser parity; B7 limit/encoding/soak |
| FR-HITL-01 | `/workspace/[id]` | section/version API | live-system manual edit; live-workflows conflict/autosave |
| FR-HITL-02 | `/workspace/[id]` | Revise Section | live-system accept/reject; B5/B6 |
| FR-HITL-03 | `/workspace/[id]` | atomic section write | other-section identity; lock/stale/version B5/B6 |
| FR-HITL-04 | `/workspace/[id]` | proposal/history API | reload pending proposal; accept/reject identity |
| FR-EXP-01 | `/export/[id]` | compiler + private Storage | real DOCX ZIP/XML; B7 formatting/captions |
| FR-EXP-02 | `/export/[id]` | LibreOffice + private download | real PDF header/text; B7 artifact checks |
| RQ1 | `/evaluation` | generation logs, Python/core structure | scope isolation; B5–B9 summaries |
| RQ2 | `/evaluation` | blind cases, ROUGE/statistics Python | real project snapshots; two reviewers; B8 numerical goldens |
| RQ3 | `/evaluation?tab=sus` | server/core/DB SUS | 100/50 vectors, reload persistence, B8 guards |
| Settings | `/settings` | credential sync + smoke + n8n | live-settings lifecycle, key hash and leakage scans |

## Reproduksi dan batas

Jalankan `pnpm test:b9` dengan webapp live dan mock provider sudah aktif. Test lain
yang memakai mock controller/Settings/evaluasi tidak boleh berjalan bersamaan.
Status per tahap tersimpan di `artifacts/b9/acceptance.json`; artifact dan snapshot
backup diabaikan Git. `pnpm scan:secrets` memeriksa tracked/new files, artifact
teks, hasil browser serta public bundle terhadap nilai env dan pola credential.
Pemeriksaan execution dan log server dilakukan melalui helper lokal.

Model default `deepseek-flash` telah dicocokkan dengan dokumentasi resmi saat B9;
tidak ada perubahan model atau key nyata. Embedding tetap layanan terpisah pada
1536 dimensi; vector mock bukan bukti penelitian. Metode PATCH credential yang
tersedia dipertahankan, dengan recovery nama/tipe dan publish di atas. Dataset
penelitian tidak diunduh/diingest B9; keterbatasan lisensi/akuisisi B4 tetap berlaku.
Local-owner Auth, enrollment penelitian dan validasi kualitas dengan provider
nyata tetap merupakan batas yang dijelaskan dalam runbook.

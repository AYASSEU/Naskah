# Checklist sebelum menggunakan API asli

Status 11 November 2026: **belum ada panggilan provider asli pada acceptance**.
Backend live lokal berfungsi dengan LLM/embedding mock port 4010. Checklist ini
untuk dilakukan pengguna kemudian; B10 tidak mengganti konfigurasi tersebut.

## Tiga hal yang perlu Anda lakukan

| Tugas | Status laptop ini | Tindakan Anda |
| --- | --- | --- |
| REST key n8n | Sudah dibuat, disimpan lokal dan diuji | Perbarui hanya jika expired/401/403; OAuth MCP bukan REST key |
| Key generation dan embeddings | Mock; belum diuji dengan key asli | Masukkan sendiri melalui Settings, cek model/dimensi dan biaya |
| Corpus sumber nyata | 150 `dev_seed` aktif; persiapan riset B4 masih provisional | Tinjau sumber/lisensi, extraction, split/chunk, lalu embed/load/verify pada lingkungan terpisah |

REST key backend perlu izin credential list/read/create/update/delete, workflow
list/read/create/update/activate/deactivate dan execution list/read/stop, sesuai
capability n8n yang terpasang. Key read-only tidak cukup untuk memasang/memperbaiki
workflow. Nilai key tetap privat; jangan tempel ke chat, URL, source atau command
line. Catat kedaluwarsa secara privat dan simpan penggantinya melalui Settings.

## Urutan uji manual nyata dan hasil yang diharapkan

1. **Backup dahulu.** Ikuti [runbook](runbook.md); simpan env/key/DB/Storage yang
   cocok. Siapkan lingkungan corpus penelitian terpisah dari dev. Pastikan data
   yang hendak dikirim memang boleh dibagikan ke provider.
2. **DeepSeek.** Settings → preset DeepSeek; default implementasi saat checkpoint
   `https://api.deepseek.com`, model `deepseek-flash`. Periksa ulang daftar model
   akun/dokumentasi ketika akan dipakai. Masukkan key sendiri, **Simpan dan
   sambungkan**. Save/Test memanggil provider dan dapat berbiaya. Sistem
   memverifikasi `/models`; alias atau model yang berubah bukan versi penelitian
   yang dibekukan. Rujukan: [dokumentasi resmi](https://api-docs.deepseek.com/).
3. **Embeddings secara terpisah.** Isi endpoint/key/model kompatibel integrasi
   embeddings. Default implementasi saat ini `text-embedding-3-small`, **1536**
   dimensi; pilihan nyata belum diuji. Model harus tersedia pada provider yang
   dipilih dan sama persis dengan ingestion/query. DeepSeek key saja tidak
   menggantikan integrasi ini. Dimensi lain memerlukan perubahan schema/RPC/tes.
4. **Corpus.** Tinjau [ingestion](../ingestion/README.md). Fetch/split/chunk boleh
   disiapkan sebelum embedding berbiaya. Split 80:20 berdasarkan dokumen/proyek
   sebelum chunking, held-out hanya di ground truth. Selesaikan gap ekstraksi
   dan 16 dokumen oversize yang dilaporkan B4. PURE/PROMISE telah didapat untuk
   persiapan B4, belum menjadi corpus penelitian tervalidasi. Kandidat Kaggle
   `corpus4panwo/fault-prone-srs-dataset` berlisensi Unknown: verifikasi ketentuan
   dan kesesuaian dahulu; jangan mengesahkan sumber hanya karena berhasil download.
5. **Embed/load/verify.** Gunakan output/cache baru dan koneksi embeddings nyata
   yang sudah diverifikasi. Jangan mencampur hash vector mock dan embedding asli
   dengan nama model sama, sekalipun keduanya 1536 dimensi. Simpan source URL,
   license/version/hash, split manifest, model/dimensi dan laporan retrieval.
6. **Uji sambungan**, lalu **Terapkan ulang sambungan**. Diharapkan ketiga indikator
   Tersimpan/Tersinkron/Teruji pada tiap provider, tujuh workflow aktif dan
   readiness tanpa alasan penghambat. Jika key/model/dimensi/rate limit gagal,
   perbaiki pesan tersebut sebelum Generate. Indikator hijau tidak menilai mutu SRS.
7. **Satu proyek smoke dev.** Gunakan input non-sensitif yang representatif.
   Harapan: empat bab selesai, ID requirement unik, sumber retrieval benar,
   asumsi/angka yang perlu konfirmasi terlihat, log menyimpan model/token/durasi.
   Edit manual; usulkan revisi satu bagian; accept satu, reject yang lain.
   Bagian di luar target harus tetap sama; lock/stale tidak boleh tertimpa.
8. **Finalisasi dan ekspor.** Buka Word/PDF nyata; periksa isi, cover, TOC,
   heading, tabel/caption dan halaman. Catat hasil dengan tanggal/commit,
   konfigurasi, returned model, input hash dan kode error bila gagal, tanpa key.
   Jangan mengklaim uji sukses sebelum observasi ini benar-benar dilakukan.

## Sebelum data masuk BAB IV

API berhasil belum memenuhi syarat penelitian. Jalur enrollment/pembuatan run
`is_thesis_run=true` **belum tersedia di UI**. Selesaikan implementasi enrollment
dan verifikasi provenance beserta tesnya sebelum mulai studi; jangan mengubah
flag secara manual untuk melewati guard. Run harus completed, non-mock, tanpa
retrieval `dev_seed`, dengan corpus/ground truth yang tervalidasi.

Bekukan protokol, baseline manusia, bahasa, desain paired/independent, persetujuan
dan rencana analisis bersama pembimbing. Perhitungkan batas satu laptop, sesi
peserta tujuh hari dan operator yang dapat mengakses mapping. Ikuti
[panduan data skripsi](thesis-data-guide.md); hasil saat ini tetap data uji.

## Kembali ke mock

Gunakan kembali lingkungan/corpus **dev** yang telah dibackup. Jika provider nyata
tersimpan di lingkungan itu, hapus kedua key provider melalui Settings sendiri,
lalu `pnpm local:setup-mock` dan **Terapkan ulang sambungan**. Helper menolak
menimpa konfigurasi non-mock yang masih tersimpan. Jangan menjalankannya pada
DB penelitian atau mengubah corpus penelitian menjadi `dev_seed`.

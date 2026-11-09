# 1. Introduction

## 1.1 Purpose (Tujuan)

Dokumen ini menetapkan kebutuhan perangkat lunak untuk **Sistem Manajemen Rumah Sakit**. Spesifikasi menjadi acuan bersama bagi analis, pengembang, penguji, dan pemangku kepentingan untuk merancang, membangun, serta memverifikasi sistem.

Dokumen mengikuti struktur IEEE 830-1998 dan memuat kebutuhan yang dapat ditelusuri serta diuji.

## 1.2 Scope (Ruang lingkup)

Sistem Manajemen Rumah Sakit mendukung pelayanan pasien, pencatatan klinis, pengelolaan farmasi, dan administrasi keuangan rumah sakit. Ruang lingkup mencakup aplikasi web, pengaturan peran pengguna, dan pelaporan.

Integrasi pihak ketiga diakses melalui antarmuka yang tervalidasi. Pengadaan perangkat keras berada di luar ruang lingkup.

## 1.3 Glossary (Glosarium)

| Istilah | Definisi |
| --- | --- |
| SRS | Software Requirements Specification |
| Aktor | Peran yang berinteraksi dengan sistem |
| REQ-F | Identitas unik kebutuhan fungsional |
| Audit trail | Catatan kronologis aktivitas pengguna |

## 1.4 References (Referensi)

1. IEEE Std 830-1998, Recommended Practice for Software Requirements Specifications.
2. Catatan kebutuhan dan hasil wawancara pemangku kepentingan.
3. Kebijakan akses dan retensi data organisasi.

Catatan standar: IEEE 830 telah digantikan ISO/IEC/IEEE 29148. Penelitian ini menggunakan IEEE 830 sesuai proposal.

# 2. Overall Description

## 2.1 Product perspective

Sistem merupakan aplikasi web terpusat yang menghubungkan pendaftaran, poliklinik, farmasi, laboratorium, kasir, manajemen, dan administrator. Setiap modul berbagi sumber data yang sama dengan kontrol akses sesuai peran.

## 2.2 User classes

| Aktor | Tanggung jawab |
| --- | --- |
| Pasien | Mengatur kunjungan dan profil |
| Petugas pendaftaran | Verifikasi identitas dan antrean |
| Dokter | Diagnosis dan tindakan |
| Perawat | Tanda vital dan observasi |
| Apoteker | Validasi serta penyerahan obat |
| Kasir | Tagihan dan pembayaran |
| Administrator | Akun, akses, dan konfigurasi |

## 2.3 Operating environment

Aplikasi diakses melalui peramban versi stabil yang mendukung ES2022, pada desktop dan perangkat bergerak dengan lebar minimum 360 piksel. Komunikasi menggunakan HTTPS. Basis data relasional menyediakan transaksi atomik dan pencadangan terjadwal.

## 2.4 Constraints and assumptions

Pengguna memiliki koneksi internet dan akun aktif. Waktu sistem disinkronkan melalui NTP. Integrasi eksternal diasumsikan menyediakan dokumentasi dan lingkungan pengujian. Data pribadi hanya diproses oleh petugas yang diberi wewenang.

# 3. Specific Requirements

## 3.1 External interfaces

### Antarmuka pengguna
Formulir memiliki label eksplisit, pesan validasi per isian, dan navigasi papan ketik. Tata letak menyesuaikan lebar 360 sampai 1440 piksel.

### Antarmuka perangkat lunak
Pertukaran data menggunakan JSON melalui HTTPS dengan status HTTP yang sesuai. Setiap permintaan memiliki pengenal korelasi untuk penelusuran.

## 3.2 Functional Requirements

**REQ-F-01 — Pendaftaran pasien**
Petugas pendaftaran dapat membuat rekam pasien dengan NIK 16 digit, nama lengkap, tanggal lahir, dan nomor telepon. Sistem menolak NIK yang telah terdaftar.

Prioritas: [High]

Aktor: Petugas pendaftaran · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-02 — Pencarian data pasien**
Petugas dapat mencari pasien berdasarkan NIK atau nomor rekam medis. Hasil pencarian ditampilkan dalam waktu tidak lebih dari 1,8 detik.

Prioritas: [High]

Aktor: Petugas pendaftaran · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-03 — Penjadwalan kunjungan**
Pasien dapat memilih dokter dan jadwal tersedia. Sistem mencegah dua janji pada dokter dan waktu yang sama.

Prioritas: [High]

Aktor: Petugas pendaftaran · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-04 — Pencatatan rekam medis**
Dokter dapat mencatat anamnesis, diagnosis ICD-10, tindakan, dan resep pada setiap kunjungan. Setiap perubahan menyimpan waktu dan identitas dokter.

Prioritas: [High]

Aktor: Petugas pendaftaran · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-05 — Pengelolaan antrean**
Sistem memberikan nomor antrean berurutan per poliklinik dan menampilkan estimasi waktu berdasarkan 12 kunjungan terakhir.

Prioritas: [High]

Aktor: Petugas pendaftaran · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-06 — Verifikasi kepesertaan BPJS**
Petugas memverifikasi status kepesertaan melalui nomor kartu sebelum menerbitkan surat eligibilitas.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-07 — Pencatatan tanda vital**
Perawat mencatat tekanan darah, denyut nadi, suhu, dan saturasi oksigen dengan satuan yang sesuai.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-08 — Rujukan antarunit**
Dokter mengirim rujukan dengan alasan klinis dan tujuan unit. Unit tujuan menerima notifikasi dalam 5 detik.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-09 — Resep elektronik**
Dokter memilih obat dari formularium, dosis, frekuensi, dan durasi. Sistem memperingatkan jika alergi pasien cocok dengan bahan aktif.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-10 — Validasi resep**
Apoteker memverifikasi dosis dan ketersediaan stok sebelum menyerahkan obat kepada pasien.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-11 — Persediaan obat**
Sistem mengurangi stok setelah penyerahan obat dan mencatat nomor batch serta tanggal kedaluwarsa.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-12 — Peringatan stok minimum**
Sistem membuat peringatan ketika stok berada di bawah ambang yang ditetapkan per jenis obat.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-13 — Permintaan laboratorium**
Dokter mengirim permintaan pemeriksaan dengan identitas pasien, jenis pemeriksaan, dan prioritas.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-14 — Pencatatan hasil laboratorium**
Analis memasukkan hasil numerik, satuan, dan rentang rujukan. Hasil hanya terbit setelah diverifikasi.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-15 — Permintaan radiologi**
Dokter mengirim permintaan radiologi beserta indikasi klinis dan pemeriksaan yang diperlukan.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-16 — Laporan radiologi**
Radiolog dapat melampirkan interpretasi dan tautan citra DICOM pada kunjungan terkait.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-17 — Tagihan layanan**
Sistem menghitung tagihan dari tarif tindakan, obat, kamar, dan pemeriksaan yang tercatat.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-18 — Pembayaran pasien**
Kasir mencatat pembayaran tunai, transfer, atau QRIS dan menerbitkan bukti pembayaran bernomor unik.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-19 — Rekonsiliasi harian**
Bagian keuangan membandingkan total transaksi dengan mutasi pembayaran per hari operasional.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-20 — Pengajuan klaim**
Petugas mengekspor klaim BPJS yang memuat diagnosis, tindakan, dan dokumen pendukung.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-21 — Pengelolaan tempat tidur**
Petugas rawat inap melihat status tersedia, terisi, atau dalam pembersihan untuk setiap tempat tidur.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-22 — Admisi rawat inap**
Petugas mencatat tanggal masuk, dokter penanggung jawab, dan kelas perawatan sebelum menempatkan pasien.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-23 — Pemulangan pasien**
Dokter melengkapi ringkasan pulang dan petugas memastikan seluruh tagihan telah diverifikasi.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-24 — Persetujuan tindakan**
Sistem menyimpan persetujuan pasien, jenis tindakan, tanggal, dan identitas pemberi penjelasan.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-25 — Manajemen pengguna**
Administrator membuat akun untuk tujuh peran dengan izin akses minimum sesuai tugas.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-26 — Autentikasi pengguna**
Pengguna masuk menggunakan identitas unik dan kata sandi minimal 12 karakter. Akun dikunci 15 menit setelah 5 percobaan gagal.

Prioritas: [High]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-27 — Pengaturan hak akses**
Administrator menetapkan izin baca, tambah, dan ubah pada setiap modul berdasarkan peran.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-28 — Audit perubahan**
Sistem merekam pelaku, waktu, jenis operasi, serta nilai sebelum dan sesudah perubahan data klinis.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-29 — Laporan kunjungan**
Manajemen memperoleh laporan kunjungan berdasarkan rentang tanggal, poliklinik, dan dokter.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-30 — Laporan pendapatan**
Manajemen dapat melihat pendapatan berdasarkan jenis layanan dan metode pembayaran.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-31 — Pencadangan data**
Sistem menjalankan pencadangan setiap 24 jam dan menyimpan 14 salinan terakhir.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-32 — Pemulihan data**
Administrator dapat memulihkan salinan terpilih dengan waktu pemulihan maksimal 4 jam.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-33 — Notifikasi jadwal**
Pasien menerima pengingat 24 jam sebelum jadwal melalui kanal yang telah disetujui.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-34 — Pembatalan janji**
Pasien dapat membatalkan janji sampai 2 jam sebelum jadwal dan slot kembali tersedia.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-35 — Profil pasien**
Pasien dapat memperbarui alamat dan kontak; perubahan NIK memerlukan verifikasi petugas.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-36 — Ekspor laporan**
Pengguna berizin dapat mengekspor laporan CSV dengan filter yang sama seperti tampilan.

Prioritas: [Medium]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-37 — Pengelolaan tarif**
Bagian keuangan menetapkan tarif dengan tanggal berlaku dan menyimpan riwayat tarif sebelumnya.

Prioritas: [Low]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-38 — Persetujuan akses darurat**
Dokter dapat meminta akses darurat dengan alasan wajib yang dikirim ke petugas kepatuhan.

Prioritas: [Low]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-39 — Retensi rekam medis**
Sistem mempertahankan rekam medis sesuai kebijakan retensi dan mencegah penghapusan tanpa persetujuan.

Prioritas: [Low]

Aktor: Pengguna berwenang · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

## 3.3 Performance requirements

Waktu respons tidak melebihi 2 detik pada beban 500 pengguna konkuren. Pengujian dilakukan pada persentil ke-95 selama interval 30 menit.

Ketersediaan layanan minimal 99,5% setiap bulan kalender. Pemeliharaan terjadwal diumumkan minimal 48 jam sebelumnya.

## 3.4 Security requirements

Data pasien dienkripsi menggunakan AES-256 saat disimpan dan TLS 1.3 saat ditransmisikan.

Setiap sesi berakhir otomatis setelah 15 menit tanpa aktivitas. Akses data mengikuti prinsip hak minimum. Seluruh perubahan data sensitif tercatat dalam audit trail yang tidak dapat diubah oleh pengguna biasa.

## 3.5 Software attributes

Petugas menyelesaikan pendaftaran pasien dalam maksimal 3 menit setelah pelatihan 30 menit.

Modul memiliki dokumentasi antarmuka dan pengujian regresi untuk alur kritis. Cadangan harian disimpan selama 14 hari, dengan uji pemulihan tiap bulan.

# 4. Supporting Artifacts

## 4.1 Use Case Narratives

### UC-01 Pendaftaran pasien
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-01 terpenuhi.

### UC-02 Pencarian data pasien
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-02 terpenuhi.

### UC-03 Penjadwalan kunjungan
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-03 terpenuhi.

### UC-04 Pencatatan rekam medis
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-04 terpenuhi.

### UC-05 Pengelolaan antrean
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-05 terpenuhi.

### UC-06 Verifikasi kepesertaan BPJS
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-06 terpenuhi.

## 4.2 Requirements Traceability Matrix

| Kebutuhan | Use case | Metode verifikasi |
| --- | --- | --- |
| REQ-F-01 | UC-01 | Uji penerimaan 1 |
| REQ-F-02 | UC-02 | Uji penerimaan 2 |
| REQ-F-03 | UC-03 | Uji penerimaan 3 |
| REQ-F-04 | UC-04 | Uji penerimaan 4 |
| REQ-F-05 | UC-05 | Uji penerimaan 5 |
| REQ-F-06 | UC-06 | Uji penerimaan 6 |
| REQ-F-07 | UC-01 | Uji penerimaan 7 |
| REQ-F-08 | UC-02 | Uji penerimaan 8 |
| REQ-F-09 | UC-03 | Uji penerimaan 9 |
| REQ-F-10 | UC-04 | Uji penerimaan 10 |
| REQ-F-11 | UC-05 | Uji penerimaan 11 |
| REQ-F-12 | UC-06 | Uji penerimaan 12 |
| REQ-F-13 | UC-01 | Uji penerimaan 13 |
| REQ-F-14 | UC-02 | Uji penerimaan 14 |
| REQ-F-15 | UC-03 | Uji penerimaan 15 |
| REQ-F-16 | UC-04 | Uji penerimaan 16 |
| REQ-F-17 | UC-05 | Uji penerimaan 17 |
| REQ-F-18 | UC-06 | Uji penerimaan 18 |
| REQ-F-19 | UC-01 | Uji penerimaan 19 |
| REQ-F-20 | UC-02 | Uji penerimaan 20 |
| REQ-F-21 | UC-03 | Uji penerimaan 21 |
| REQ-F-22 | UC-04 | Uji penerimaan 22 |
| REQ-F-23 | UC-05 | Uji penerimaan 23 |
| REQ-F-24 | UC-06 | Uji penerimaan 24 |
| REQ-F-25 | UC-01 | Uji penerimaan 25 |
| REQ-F-26 | UC-02 | Uji penerimaan 26 |
| REQ-F-27 | UC-03 | Uji penerimaan 27 |
| REQ-F-28 | UC-04 | Uji penerimaan 28 |
| REQ-F-29 | UC-05 | Uji penerimaan 29 |
| REQ-F-30 | UC-06 | Uji penerimaan 30 |
| REQ-F-31 | UC-01 | Uji penerimaan 31 |
| REQ-F-32 | UC-02 | Uji penerimaan 32 |
| REQ-F-33 | UC-03 | Uji penerimaan 33 |
| REQ-F-34 | UC-04 | Uji penerimaan 34 |
| REQ-F-35 | UC-05 | Uji penerimaan 35 |
| REQ-F-36 | UC-06 | Uji penerimaan 36 |
| REQ-F-37 | UC-01 | Uji penerimaan 37 |
| REQ-F-38 | UC-02 | Uji penerimaan 38 |
| REQ-F-39 | UC-03 | Uji penerimaan 39 |

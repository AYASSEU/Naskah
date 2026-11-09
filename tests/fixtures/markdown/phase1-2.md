# 1. Introduction

## 1.1 Purpose (Tujuan)

Dokumen ini menetapkan kebutuhan perangkat lunak untuk **Aplikasi pembayaran UMKM dengan QRIS**. Spesifikasi menjadi acuan bersama bagi analis, pengembang, penguji, dan pemangku kepentingan untuk merancang, membangun, serta memverifikasi sistem.

Dokumen mengikuti struktur IEEE 830-1998 dan memuat kebutuhan yang dapat ditelusuri serta diuji.

## 1.2 Scope (Ruang lingkup)

Aplikasi pembayaran UMKM dengan QRIS mendukung penerimaan pembayaran digital dan rekonsiliasi usaha mikro, kecil, dan menengah. Ruang lingkup mencakup aplikasi web, pengaturan peran pengguna, dan pelaporan.

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

Sistem merupakan aplikasi web terpusat yang menghubungkan pengguna, operator, dan administrator. Setiap modul berbagi sumber data yang sama dengan kontrol akses sesuai peran.

## 2.2 User classes

Pengguna terdaftar mengakses fungsi sesuai tugas. Operator memverifikasi data dan menindaklanjuti permintaan. Administrator mengatur peran, hak akses, dan konfigurasi.

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

**REQ-F-01 — Registrasi merchant**
Pemilik usaha mendaftarkan NIB, identitas pemilik, nama usaha, dan rekening settlement.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-02 — Pembuatan QRIS dinamis**
Kasir membuat kode QRIS dengan nominal transaksi dan masa berlaku 5 menit.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-03 — Konfirmasi pembayaran**
Sistem memverifikasi signature callback dan memperbarui status pembayaran dalam 5 detik.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-04 — Riwayat transaksi**
Merchant dapat memfilter transaksi berdasarkan tanggal, nominal, dan status pembayaran.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-05 — Rekonsiliasi settlement**
Sistem mencocokkan nilai settlement dengan transaksi berhasil setiap hari pukul 23.00 WIB.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-06 — Pengembalian dana**
Merchant mengajukan refund dengan referensi transaksi dan alasan, maksimal senilai transaksi asal.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-07 — Pengelolaan kasir**
Pemilik mengatur akun kasir dengan batas akses per gerai.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-08 — Ekspor transaksi**
Merchant mengekspor CSV berisi nomor transaksi, waktu, bruto, biaya, dan neto.

Prioritas: [High]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-09 — Laporan harian**
Sistem menampilkan total transaksi berhasil dan pendapatan neto per gerai.

Prioritas: [Medium]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-10 — Audit autentikasi**
Sistem mencatat seluruh upaya login, hasil verifikasi, dan alamat IP selama 90 hari.

Prioritas: [Low]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-11 — Notifikasi pembayaran**
Kasir mendapat pemberitahuan saat pembayaran berhasil tanpa membuka ulang halaman.

Prioritas: [Low]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

**REQ-F-12 — Validasi nominal**
Sistem menolak nominal di bawah Rp1 dan di atas batas transaksi yang dikonfigurasi.

Prioritas: [Low]

Aktor: Pengguna terdaftar · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.

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

### UC-01 Registrasi merchant
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-01 terpenuhi.

### UC-02 Pembuatan QRIS dinamis
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-02 terpenuhi.

### UC-03 Konfirmasi pembayaran
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-03 terpenuhi.

### UC-04 Riwayat transaksi
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-04 terpenuhi.

### UC-05 Rekonsiliasi settlement
**Aktor:** pengguna berwenang.

**Prakondisi:** pengguna telah masuk dan memiliki izin.

**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.

**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.

**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-05 terpenuhi.

### UC-06 Pengembalian dana
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

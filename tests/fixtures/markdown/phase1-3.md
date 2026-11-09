# 1. Introduction

## 1.1 Purpose (Tujuan)

Dokumen ini menetapkan kebutuhan perangkat lunak untuk **Perpustakaan digital kampus**. Spesifikasi menjadi acuan bersama bagi analis, pengembang, penguji, dan pemangku kepentingan untuk merancang, membangun, serta memverifikasi sistem.

Dokumen mengikuti struktur IEEE 830-1998 dan memuat kebutuhan yang dapat ditelusuri serta diuji.

## 1.2 Scope (Ruang lingkup)

Perpustakaan digital kampus mendukung penelusuran koleksi, peminjaman, dan pengelolaan perpustakaan kampus. Ruang lingkup mencakup aplikasi web, pengaturan peran pengguna, dan pelaporan.

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



## 3.2 Functional Requirements



## 3.3 Performance requirements



## 3.4 Security requirements



## 3.5 Software attributes



# 4. Supporting Artifacts

## 4.1 Use Case Narratives



## 4.2 Requirements Traceability Matrix



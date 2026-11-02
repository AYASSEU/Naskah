import type {
  Project,
  SrsDocument,
  Section,
  GenerationLog,
  RetrievedChunk,
  GuardrailReport,
} from '@naskah/contracts';
import { ieeeTemplate } from '@/entities/template/ieee';
import { parseRequirements } from '@/entities/requirement/parsing';
const date = '2026-10-22T10:23:00.000Z';
const uid = (n: number) => `e73b9f22-1648-4619-a410-${String(n).padStart(12, '0')}`;
export const fixtureProjects: Project[] = [
  {
    id: uid(1),
    ownerId: 'local',
    title: 'Sistem Manajemen Rumah Sakit',
    domain: 'Healthcare',
    version: '0.3',
    status: 'in_review',
    createdAt: '2026-10-20T04:20:00.000Z',
    updatedAt: date,
    sessionId: uid(11),
    rawText:
      'Rumah Sakit Bina Sehat memerlukan sistem terintegrasi untuk pendaftaran pasien, rekam medis, farmasi, dan penagihan. Tujuh jenis pengguna dengan kontrol akses berbasis peran.',
  },
  {
    id: uid(2),
    ownerId: 'local',
    title: 'Aplikasi pembayaran UMKM dengan QRIS',
    domain: 'Fintech',
    version: '0.1',
    status: 'in_review',
    createdAt: '2026-10-19T03:12:00.000Z',
    updatedAt: '2026-10-21T08:47:00.000Z',
    sessionId: uid(12),
    rawText:
      'Pelaku UMKM menerima pembayaran QRIS, memeriksa status transaksi, melakukan rekonsiliasi harian, dan mengekspor laporan.',
  },
  {
    id: uid(3),
    ownerId: 'local',
    title: 'Perpustakaan digital kampus',
    domain: 'Education',
    version: '0.2',
    status: 'failed',
    createdAt: '2026-10-18T09:31:00.000Z',
    updatedAt: '2026-10-20T07:18:00.000Z',
    sessionId: uid(13),
    rawText:
      'Mahasiswa mencari koleksi digital, meminjam buku selama 7 hari, mendapat pengingat pengembalian dan mengusulkan pengadaan.',
  },
];
export const hospitalRequirements = [
  [
    'Pendaftaran pasien',
    'Petugas pendaftaran dapat membuat rekam pasien dengan NIK 16 digit, nama lengkap, tanggal lahir, dan nomor telepon. Sistem menolak NIK yang telah terdaftar.',
  ],
  [
    'Pencarian data pasien',
    'Petugas dapat mencari pasien berdasarkan NIK atau nomor rekam medis. Hasil pencarian ditampilkan dalam waktu tidak lebih dari 1,8 detik.',
  ],
  [
    'Penjadwalan kunjungan',
    'Pasien dapat memilih dokter dan jadwal tersedia. Sistem mencegah dua janji pada dokter dan waktu yang sama.',
  ],
  [
    'Pencatatan rekam medis',
    'Dokter dapat mencatat anamnesis, diagnosis ICD-10, tindakan, dan resep pada setiap kunjungan. Setiap perubahan menyimpan waktu dan identitas dokter.',
  ],
  [
    'Pengelolaan antrean',
    'Sistem memberikan nomor antrean berurutan per poliklinik dan menampilkan estimasi waktu berdasarkan 12 kunjungan terakhir.',
  ],
  [
    'Verifikasi kepesertaan BPJS',
    'Petugas memverifikasi status kepesertaan melalui nomor kartu sebelum menerbitkan surat eligibilitas.',
  ],
  [
    'Pencatatan tanda vital',
    'Perawat mencatat tekanan darah, denyut nadi, suhu, dan saturasi oksigen dengan satuan yang sesuai.',
  ],
  [
    'Rujukan antarunit',
    'Dokter mengirim rujukan dengan alasan klinis dan tujuan unit. Unit tujuan menerima notifikasi dalam 5 detik.',
  ],
  [
    'Resep elektronik',
    'Dokter memilih obat dari formularium, dosis, frekuensi, dan durasi. Sistem memperingatkan jika alergi pasien cocok dengan bahan aktif.',
  ],
  [
    'Validasi resep',
    'Apoteker memverifikasi dosis dan ketersediaan stok sebelum menyerahkan obat kepada pasien.',
  ],
  [
    'Persediaan obat',
    'Sistem mengurangi stok setelah penyerahan obat dan mencatat nomor batch serta tanggal kedaluwarsa.',
  ],
  [
    'Peringatan stok minimum',
    'Sistem membuat peringatan ketika stok berada di bawah ambang yang ditetapkan per jenis obat.',
  ],
  [
    'Permintaan laboratorium',
    'Dokter mengirim permintaan pemeriksaan dengan identitas pasien, jenis pemeriksaan, dan prioritas.',
  ],
  [
    'Pencatatan hasil laboratorium',
    'Analis memasukkan hasil numerik, satuan, dan rentang rujukan. Hasil hanya terbit setelah diverifikasi.',
  ],
  [
    'Permintaan radiologi',
    'Dokter mengirim permintaan radiologi beserta indikasi klinis dan pemeriksaan yang diperlukan.',
  ],
  [
    'Laporan radiologi',
    'Radiolog dapat melampirkan interpretasi dan tautan citra DICOM pada kunjungan terkait.',
  ],
  [
    'Tagihan layanan',
    'Sistem menghitung tagihan dari tarif tindakan, obat, kamar, dan pemeriksaan yang tercatat.',
  ],
  [
    'Pembayaran pasien',
    'Kasir mencatat pembayaran tunai, transfer, atau QRIS dan menerbitkan bukti pembayaran bernomor unik.',
  ],
  [
    'Rekonsiliasi harian',
    'Bagian keuangan membandingkan total transaksi dengan mutasi pembayaran per hari operasional.',
  ],
  [
    'Pengajuan klaim',
    'Petugas mengekspor klaim BPJS yang memuat diagnosis, tindakan, dan dokumen pendukung.',
  ],
  [
    'Pengelolaan tempat tidur',
    'Petugas rawat inap melihat status tersedia, terisi, atau dalam pembersihan untuk setiap tempat tidur.',
  ],
  [
    'Admisi rawat inap',
    'Petugas mencatat tanggal masuk, dokter penanggung jawab, dan kelas perawatan sebelum menempatkan pasien.',
  ],
  [
    'Pemulangan pasien',
    'Dokter melengkapi ringkasan pulang dan petugas memastikan seluruh tagihan telah diverifikasi.',
  ],
  [
    'Persetujuan tindakan',
    'Sistem menyimpan persetujuan pasien, jenis tindakan, tanggal, dan identitas pemberi penjelasan.',
  ],
  [
    'Manajemen pengguna',
    'Administrator membuat akun untuk tujuh peran dengan izin akses minimum sesuai tugas.',
  ],
  [
    'Autentikasi pengguna',
    'Pengguna masuk menggunakan identitas unik dan kata sandi minimal 12 karakter. Akun dikunci 15 menit setelah 5 percobaan gagal.',
  ],
  [
    'Pengaturan hak akses',
    'Administrator menetapkan izin baca, tambah, dan ubah pada setiap modul berdasarkan peran.',
  ],
  [
    'Audit perubahan',
    'Sistem merekam pelaku, waktu, jenis operasi, serta nilai sebelum dan sesudah perubahan data klinis.',
  ],
  [
    'Laporan kunjungan',
    'Manajemen memperoleh laporan kunjungan berdasarkan rentang tanggal, poliklinik, dan dokter.',
  ],
  [
    'Laporan pendapatan',
    'Manajemen dapat melihat pendapatan berdasarkan jenis layanan dan metode pembayaran.',
  ],
  [
    'Pencadangan data',
    'Sistem menjalankan pencadangan setiap 24 jam dan menyimpan 14 salinan terakhir.',
  ],
  [
    'Pemulihan data',
    'Administrator dapat memulihkan salinan terpilih dengan waktu pemulihan maksimal 4 jam.',
  ],
  [
    'Notifikasi jadwal',
    'Pasien menerima pengingat 24 jam sebelum jadwal melalui kanal yang telah disetujui.',
  ],
  [
    'Pembatalan janji',
    'Pasien dapat membatalkan janji sampai 2 jam sebelum jadwal dan slot kembali tersedia.',
  ],
  [
    'Profil pasien',
    'Pasien dapat memperbarui alamat dan kontak; perubahan NIK memerlukan verifikasi petugas.',
  ],
  [
    'Ekspor laporan',
    'Pengguna berizin dapat mengekspor laporan CSV dengan filter yang sama seperti tampilan.',
  ],
  [
    'Pengelolaan tarif',
    'Bagian keuangan menetapkan tarif dengan tanggal berlaku dan menyimpan riwayat tarif sebelumnya.',
  ],
  [
    'Persetujuan akses darurat',
    'Dokter dapat meminta akses darurat dengan alasan wajib yang dikirim ke petugas kepatuhan.',
  ],
  [
    'Retensi rekam medis',
    'Sistem mempertahankan rekam medis sesuai kebijakan retensi dan mencegah penghapusan tanpa persetujuan.',
  ],
];
export function guardrail(number: string): GuardrailReport {
  return {
    dimensions: [
      {
        name: 'unambiguous',
        passed: true,
        reason: 'Ambang dan aktor dituliskan secara eksplisit.',
      },
      { name: 'complete', passed: true, reason: 'Masukan, proses, dan keluaran terdefinisi.' },
      { name: 'correct', passed: true, reason: 'Konsisten dengan konteks yang diberikan.' },
      { name: 'verifiable', passed: true, reason: 'Memiliki kriteria penerimaan terukur.' },
    ],
    rewrites:
      number === '3.3'
        ? [
            {
              id: 'r1',
              original: 'Sistem harus cepat',
              rewritten: 'Waktu respons tidak melebihi 2 detik pada beban 500 pengguna konkuren',
              reason: 'Batas waktu dan beban dapat diuji.',
              resolved: false,
            },
            {
              id: 'r2',
              original: 'Sistem harus selalu tersedia',
              rewritten: 'Ketersediaan layanan minimal 99,5% setiap bulan kalender',
              reason: 'Periode pengukuran dan ambang dinyatakan.',
              resolved: false,
            },
          ]
        : number === '3.4'
          ? [
              {
                id: 'r3',
                original: 'Data pasien harus aman',
                rewritten:
                  'Data pasien dienkripsi menggunakan AES-256 saat disimpan dan TLS 1.3 saat ditransmisikan',
                reason: 'Algoritma dan cakupan dinyatakan.',
                resolved: false,
              },
            ]
          : number === '3.5'
            ? [
                {
                  id: 'r4',
                  original: 'Sistem mudah digunakan',
                  rewritten:
                    'Petugas menyelesaikan pendaftaran pasien dalam maksimal 3 menit setelah pelatihan 30 menit',
                  reason: 'Efektivitas dapat diukur dalam pengujian tugas.',
                  resolved: false,
                },
              ]
            : [],
  };
}
export function chunksFor(domain: string): RetrievedChunk[] {
  return [
    [
      'PURE',
      0.9173,
      'The system shall assign a unique identifier to each registered user and validate mandatory fields.',
    ],
    [
      'PROMISE_exp',
      0.8861,
      'The system shall provide role-based access and record all changes to sensitive records.',
    ],
    [
      'Kaggle',
      0.8537,
      'A transaction must be committed atomically; failed operations shall not alter the account balance.',
    ],
    [
      'PURE',
      0.8294,
      'The application shall return search results within two seconds for 500 concurrent sessions.',
    ],
    [
      'PROMISE_exp',
      0.7968,
      'Audit records shall contain the actor identifier, operation, timestamp and affected resource.',
    ],
    [
      'Kaggle',
      0.7642,
      'A daily backup shall be retained for fourteen days and tested for recovery every month.',
    ],
  ].map((v, i) => ({
    id: `${domain}-${i}`,
    dataset: v[0] as RetrievedChunk['dataset'],
    similarity: Number(v[1]),
    excerpt: String(v[2]),
  }));
}
function sectionContent(number: string, p: Project) {
  const healthcare = p.domain === 'Healthcare';
  const requirements = healthcare
    ? hospitalRequirements
    : p.domain === 'Fintech'
      ? [
          [
            'Registrasi merchant',
            'Pemilik usaha mendaftarkan NIB, identitas pemilik, nama usaha, dan rekening settlement.',
          ],
          [
            'Pembuatan QRIS dinamis',
            'Kasir membuat kode QRIS dengan nominal transaksi dan masa berlaku 5 menit.',
          ],
          [
            'Konfirmasi pembayaran',
            'Sistem memverifikasi signature callback dan memperbarui status pembayaran dalam 5 detik.',
          ],
          [
            'Riwayat transaksi',
            'Merchant dapat memfilter transaksi berdasarkan tanggal, nominal, dan status pembayaran.',
          ],
          [
            'Rekonsiliasi settlement',
            'Sistem mencocokkan nilai settlement dengan transaksi berhasil setiap hari pukul 23.00 WIB.',
          ],
          [
            'Pengembalian dana',
            'Merchant mengajukan refund dengan referensi transaksi dan alasan, maksimal senilai transaksi asal.',
          ],
          ['Pengelolaan kasir', 'Pemilik mengatur akun kasir dengan batas akses per gerai.'],
          [
            'Ekspor transaksi',
            'Merchant mengekspor CSV berisi nomor transaksi, waktu, bruto, biaya, dan neto.',
          ],
          [
            'Laporan harian',
            'Sistem menampilkan total transaksi berhasil dan pendapatan neto per gerai.',
          ],
          [
            'Audit autentikasi',
            'Sistem mencatat seluruh upaya login, hasil verifikasi, dan alamat IP selama 90 hari.',
          ],
          [
            'Notifikasi pembayaran',
            'Kasir mendapat pemberitahuan saat pembayaran berhasil tanpa membuka ulang halaman.',
          ],
          [
            'Validasi nominal',
            'Sistem menolak nominal di bawah Rp1 dan di atas batas transaksi yang dikonfigurasi.',
          ],
        ]
      : [
          [
            'Pencarian koleksi',
            'Mahasiswa mencari koleksi berdasarkan judul, penulis, dan kata kunci. Hasil tampil dalam 2 detik.',
          ],
          [
            'Peminjaman digital',
            'Mahasiswa meminjam maksimal 3 buku selama 7 hari setelah autentikasi SSO kampus.',
          ],
          [
            'Pengembalian otomatis',
            'Hak akses buku berakhir setelah masa peminjaman dan kuota mahasiswa diperbarui.',
          ],
          [
            'Pengingat pengembalian',
            'Sistem mengirim pengingat 24 jam sebelum peminjaman berakhir.',
          ],
          [
            'Usulan pengadaan',
            'Mahasiswa mengajukan judul, penulis, dan alasan untuk ditinjau pustakawan.',
          ],
          [
            'Manajemen koleksi',
            'Pustakawan mengelola metadata, berkas, dan lisensi setiap koleksi.',
          ],
          [
            'Laporan peminjaman',
            'Pustakawan mengekspor statistik peminjaman bulanan menurut fakultas.',
          ],
        ];
  const contents: Record<string, string> = {
    '1.1': `Dokumen ini menetapkan kebutuhan perangkat lunak untuk **${p.title}**. Spesifikasi menjadi acuan bersama bagi analis, pengembang, penguji, dan pemangku kepentingan untuk merancang, membangun, serta memverifikasi sistem.\n\nDokumen mengikuti struktur IEEE 830-1998 dan memuat kebutuhan yang dapat ditelusuri serta diuji.`,
    '1.2': `${p.title} mendukung ${healthcare ? 'pelayanan pasien, pencatatan klinis, pengelolaan farmasi, dan administrasi keuangan rumah sakit' : p.domain === 'Fintech' ? 'penerimaan pembayaran digital dan rekonsiliasi usaha mikro, kecil, dan menengah' : 'penelusuran koleksi, peminjaman, dan pengelolaan perpustakaan kampus'}. Ruang lingkup mencakup aplikasi web, pengaturan peran pengguna, dan pelaporan.\n\nIntegrasi pihak ketiga diakses melalui antarmuka yang tervalidasi. Pengadaan perangkat keras berada di luar ruang lingkup.`,
    '1.3':
      '| Istilah | Definisi |\n| --- | --- |\n| SRS | Software Requirements Specification |\n| Aktor | Peran yang berinteraksi dengan sistem |\n| REQ-F | Identitas unik kebutuhan fungsional |\n| Audit trail | Catatan kronologis aktivitas pengguna |',
    '1.4':
      '1. IEEE Std 830-1998, Recommended Practice for Software Requirements Specifications.\n2. Catatan kebutuhan dan hasil wawancara pemangku kepentingan.\n3. Kebijakan akses dan retensi data organisasi.\n\nCatatan standar: IEEE 830 telah digantikan ISO/IEC/IEEE 29148. Penelitian ini menggunakan IEEE 830 sesuai proposal.',
    '2.1': `Sistem merupakan aplikasi web terpusat yang menghubungkan ${healthcare ? 'pendaftaran, poliklinik, farmasi, laboratorium, kasir, manajemen, dan administrator' : 'pengguna, operator, dan administrator'}. Setiap modul berbagi sumber data yang sama dengan kontrol akses sesuai peran.`,
    '2.2': healthcare
      ? '| Aktor | Tanggung jawab |\n| --- | --- |\n| Pasien | Mengatur kunjungan dan profil |\n| Petugas pendaftaran | Verifikasi identitas dan antrean |\n| Dokter | Diagnosis dan tindakan |\n| Perawat | Tanda vital dan observasi |\n| Apoteker | Validasi serta penyerahan obat |\n| Kasir | Tagihan dan pembayaran |\n| Administrator | Akun, akses, dan konfigurasi |'
      : 'Pengguna terdaftar mengakses fungsi sesuai tugas. Operator memverifikasi data dan menindaklanjuti permintaan. Administrator mengatur peran, hak akses, dan konfigurasi.',
    '2.3':
      'Aplikasi diakses melalui peramban versi stabil yang mendukung ES2022, pada desktop dan perangkat bergerak dengan lebar minimum 360 piksel. Komunikasi menggunakan HTTPS. Basis data relasional menyediakan transaksi atomik dan pencadangan terjadwal.',
    '2.4':
      'Pengguna memiliki koneksi internet dan akun aktif. Waktu sistem disinkronkan melalui NTP. Integrasi eksternal diasumsikan menyediakan dokumentasi dan lingkungan pengujian. Data pribadi hanya diproses oleh petugas yang diberi wewenang.',
    '3.1':
      '### Antarmuka pengguna\nFormulir memiliki label eksplisit, pesan validasi per isian, dan navigasi papan ketik. Tata letak menyesuaikan lebar 360 sampai 1440 piksel.\n\n### Antarmuka perangkat lunak\nPertukaran data menggunakan JSON melalui HTTPS dengan status HTTP yang sesuai. Setiap permintaan memiliki pengenal korelasi untuk penelusuran.',
    '3.2': requirements
      .map(
        (r, i) =>
          `**REQ-F-${String(i + 1).padStart(2, '0')} — ${r[0]}**\n${r[1]}\n\nPrioritas: [${i < Math.ceil(requirements.length * 0.65) ? 'High' : i < requirements.length - 3 ? 'Medium' : 'Low'}]\n\nAktor: ${healthcare ? (i < 5 ? 'Petugas pendaftaran' : 'Pengguna berwenang') : 'Pengguna terdaftar'} · Input: data tervalidasi · Proses: validasi dan penyimpanan · Output: konfirmasi tercatat.`,
      )
      .join('\n\n'),
    '3.3':
      'Waktu respons tidak melebihi 2 detik pada beban 500 pengguna konkuren. Pengujian dilakukan pada persentil ke-95 selama interval 30 menit.\n\nKetersediaan layanan minimal 99,5% setiap bulan kalender. Pemeliharaan terjadwal diumumkan minimal 48 jam sebelumnya.',
    '3.4':
      'Data pasien dienkripsi menggunakan AES-256 saat disimpan dan TLS 1.3 saat ditransmisikan.\n\nSetiap sesi berakhir otomatis setelah 15 menit tanpa aktivitas. Akses data mengikuti prinsip hak minimum. Seluruh perubahan data sensitif tercatat dalam audit trail yang tidak dapat diubah oleh pengguna biasa.',
    '3.5':
      'Petugas menyelesaikan pendaftaran pasien dalam maksimal 3 menit setelah pelatihan 30 menit.\n\nModul memiliki dokumentasi antarmuka dan pengujian regresi untuk alur kritis. Cadangan harian disimpan selama 14 hari, dengan uji pemulihan tiap bulan.',
    '4.1': requirements
      .slice(0, 6)
      .map(
        (r, i) =>
          `### UC-${String(i + 1).padStart(2, '0')} ${r[0]}\n**Aktor:** pengguna berwenang.\n\n**Prakondisi:** pengguna telah masuk dan memiliki izin.\n\n**Alur utama:** pengguna membuka modul, mengisi data, mengirim permintaan, lalu sistem memvalidasi dan menyimpan.\n\n**Alur alternatif:** jika validasi gagal, sistem menampilkan isian yang perlu diperbaiki.\n\n**Pascakondisi:** transaksi tercatat dan kebutuhan REQ-F-${String(i + 1).padStart(2, '0')} terpenuhi.`,
      )
      .join('\n\n'),
    '4.2':
      '| Kebutuhan | Use case | Metode verifikasi |\n| --- | --- | --- |\n' +
      requirements
        .map(
          (_, i) =>
            `| REQ-F-${String(i + 1).padStart(2, '0')} | UC-${String((i % 6) + 1).padStart(2, '0')} | Uji penerimaan ${i + 1} |`,
        )
        .join('\n'),
  };
  return contents[number] || '';
}
export function makeDocument(p: Project, pending = false): SrsDocument {
  const sections: Section[] = ieeeTemplate.chapters.flatMap((c) =>
    c.subsections.map((s) => {
      const markdown = sectionContent(s.number, p);
      const incomplete = pending || (p.status === 'failed' && Number(c.number) >= 3);
      return {
        id: s.number,
        number: s.number,
        title: s.title,
        markdown: incomplete ? '' : markdown,
        status: incomplete ? 'pending' : 'drafted',
        source: 'ai',
        requirements: parseRequirements(incomplete ? '' : markdown),
        guardrail: guardrail(s.number),
        updatedAt: date,
      } as Section;
    }),
  );
  return {
    projectId: p.id,
    templateId: ieeeTemplate.id,
    sections,
    metadata: { title: p.title, domain: p.domain, createdAt: p.createdAt, generationSeconds: 31.7 },
    chunks: chunksFor(p.domain),
  };
}
export const fixtureLogs: GenerationLog[] = Array.from({ length: 12 }, (_, i) => ({
  session_id: uid(100 + i),
  project_title: [
    ...fixtureProjects.map((p) => p.title),
    'Sistem logistik koperasi',
    'Portal pelayanan desa',
    'Inventori toko buku',
  ][i % 6]!,
  domain: ['Healthcare', 'Fintech', 'Education', 'Logistics', 'Government', 'E-commerce'][i % 6]!,
  status: i === 5 || i === 9 ? 'failed' : 'success',
  execution_time_seconds: [31.7, 28.4, 36.8, 32.1, 29.6, 17.3, 34.2, 27.9, 39.1, 22.6, 33.8, 30.4][
    i
  ]!,
  structure_completeness_pct: i === 5 ? 58 : i === 9 ? 79 : 100,
  created_at: new Date(Date.UTC(2026, 9, 10 + i, 7, 18)).toISOString(),
}));

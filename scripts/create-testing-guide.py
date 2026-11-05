from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/guides'
SHOTS=ROOT/'artifacts/test-guide/screenshots'
if not SHOTS.exists():
    SHOTS=ROOT/'docs/guides/screenshots'
OUT.mkdir(parents=True,exist_ok=True)
doc=Document();s=doc.sections[0]
s.page_width=Inches(8.27);s.page_height=Inches(11.69)
s.top_margin=s.bottom_margin=Inches(.7);s.left_margin=s.right_margin=Inches(.8)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Caption']:
 st=doc.styles[name];st.font.name='Liberation Sans';st.font.color.rgb=RGBColor(0,0,0)
 st.paragraph_format.space_after=Pt(7)
doc.styles['Normal'].font.size=Pt(10.5)
doc.styles['Normal'].paragraph_format.line_spacing=1.12
doc.styles['Title'].font.size=Pt(27)
doc.styles['Heading 1'].font.size=Pt(19)
doc.styles['Heading 2'].font.size=Pt(12)
doc.styles['Caption'].font.size=Pt(9)
doc.core_properties.title='Panduan pengujian aplikasi web Naskah secara lokal'
doc.core_properties.subject='Urutan pengujian antarmuka dan pemeriksaan sambungan backend live'
doc.core_properties.author='Naskah project'
footer=s.footer.paragraphs[0];footer.alignment=2
footer.add_run('Panduan pengujian Naskah  |  ')
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)

def p(text):doc.add_paragraph(text)
def step(n,text):p(f'{n}. {text}')
def code(text):
 paragraph=doc.add_paragraph();paragraph.paragraph_format.space_after=Pt(9)
 r=paragraph.add_run(text);r.font.name='Liberation Mono';r.font.size=Pt(9)
def shot(name,caption,height=3.5):
 path=SHOTS/f'{name}.png'
 im=Image.open(path);width=min(6.65,height*im.width/im.height)
 paragraph=doc.add_paragraph();paragraph.alignment=1
 paragraph.add_run().add_picture(str(path),width=Inches(width))
 # Native alt text travels with the embedded screenshot.
 drawing=paragraph._p.xpath('.//wp:docPr')[0];drawing.set('descr',caption)
 doc.add_paragraph(caption,'Caption')
def page(title):doc.add_page_break();doc.add_heading(title,level=1)

doc.add_paragraph('Panduan pengujian aplikasi web Naskah secara lokal','Title')
p('Panduan berurutan untuk menguji aplikasi saat ini di Windows. Ikuti alur mode simulasi terlebih dahulu, lalu periksa integrasi Pengaturan pada mode live. Nama tombol mengikuti tampilan aplikasi agar mudah dicocokkan dengan tangkapan layar.')
p('Diverifikasi pada 5 November 2026 dengan kode dasar commit ad08a86 di AYASSEU/Naskah. Alur dokumen lengkap saat ini berjalan dalam mode simulasi. Mode live mendukung pengaturan integrasi terenkripsi, sinkronisasi kredensial n8n, dan status korpus. Layanan pembuatan dokumen, revisi, kompilasi, dan penelitian masih dikembangkan.')
doc.add_heading('Daftar fitur A sampai M',level=2)
p('Status SIMULASI berarti fitur berjalan dengan data contoh di peramban. LIVE berarti sudah terhubung ke layanan lokal. DALAM PENGEMBANGAN berarti backend lengkapnya belum tersedia.')
features_first=[
('A','Daftar dan pencarian proyek','SIMULASI','Menampilkan proyek, status, pencarian, penyaringan, serta akses kembali ke dokumen.'),
('B','Pembuatan proyek','SIMULASI','Mengisi judul, domain, versi, dan memeriksa kelengkapan isian wajib.'),
('C','Masukan kebutuhan berbentuk teks','SIMULASI','Menerima deskripsi sistem, catatan, atau transkrip sebagai konteks awal.'),
('D','Unggah PDF dan TXT','SIMULASI','Membaca berkas sumber yang didukung; PDF memerlukan lapisan teks.'),
('E','Peninjauan dan penggabungan sumber','SIMULASI','Meninjau teks ekstraksi dan menggabungkannya dengan catatan pengguna.'),
('F','Penyusunan SRS IEEE','SIMULASI','Menyusun empat bagian IEEE 830 beserta subbagiannya. Backend live masih dikembangkan.'),
('G','Progres dan pemulihan penyusunan','SIMULASI','Memantau tahap, membatalkan proses, dan melanjutkan draf setelah kegagalan.'),
('H','Ruang kerja naskah','SIMULASI','Membaca dokumen melalui daftar isi, navigasi bagian, dan tampilan Markdown.'),
('I','Penyuntingan manual','SIMULASI','Mengubah dan menyimpan bagian tanpa meminta revisi AI.'),
('J','Pengelolaan kebutuhan','SIMULASI','Menampilkan ID serta prioritas kebutuhan dan memperingatkan duplikasi ID.'),
('K','Penguncian bagian','SIMULASI','Melindungi bagian yang dikunci dari perubahan melalui alur antarmuka.'),
('L','Riwayat dan versi dokumen','SIMULASI','Memeriksa versi tersimpan dan memulihkan konten uji dari riwayat.'),
('M','Permintaan revisi AI terarah','SIMULASI','Memberi instruksi revisi untuk bagian tertentu. Workflow revisi live belum selesai.'),
]
features_second=[
('N','Perbandingan dan persetujuan revisi','SIMULASI','Membandingkan teks, menerima atau menolak usulan, serta menjaga bagian lain tetap sama.'),
('O','Pemeriksaan mutu kebutuhan','SIMULASI','Meninjau kejelasan, kelengkapan, kebenaran, dan keterujian. Konfirmasi asumsi numerik live masih dikembangkan.'),
('P','Panel sumber dan konteks RAG','SIMULASI','Memeriksa contoh sumber dan kemiripan pada dokumen. Integrasi dengan generasi live masih dikembangkan.'),
('Q','Peninjauan dan finalisasi','SIMULASI','Memastikan penulis meninjau dokumen sebelum menyetujui hasil akhir.'),
('R','Ekspor Word','SIMULASI','Mengunduh DOCX nyata dari sisi peramban. Kompilator server masih dikembangkan.'),
('S','Simpan sebagai PDF','SIMULASI','Menggunakan dialog cetak peramban. Ekspor PDF melalui server masih dikembangkan.'),
('T','Ringkasan evaluasi dan impor hasil','SIMULASI','Menampilkan data contoh serta impor ROUGE dan statistik. Backend penelitian belum selesai.'),
('U','Penilaian pakar tersamar','SIMULASI','Menilai dokumen A dan B pada empat dimensi dengan alasan penilaian.'),
('V','Kuesioner SUS','SIMULASI','Mengisi sepuluh butir dan menghitung skor, termasuk tampilan bertahap pada layar kecil.'),
('W','Preferensi dan tampilan responsif','SIMULASI','Mengganti tema, bahasa, tampilan kertas, serta menyesuaikan antarmuka dengan lebar layar.'),
('X','Pengaturan integrasi dan kredensial','LIVE','Menyimpan kunci terenkripsi, menyinkronkan kredensial n8n, menguji, mengganti, menghapus, dan menerapkan ulang sambungan.'),
('Y','Ingestion dan basis pengetahuan','LIVE','Memproses korpus, membagi data, membuat embedding, memuat indeks, dan memverifikasi 150 potongan pengembangan.'),
('Z','Diagnosis dan alat pengujian','SIMULASI DAN LIVE','Menguji skenario kegagalan dan memeriksa kesiapan layanan. Workflow produksi serta backend penelitian lengkap masih dikembangkan.'),
]
def feature_list(rows):
 for letter,title,status,description in rows:
  paragraph=doc.add_paragraph()
  paragraph.paragraph_format.space_after=Pt(7)
  paragraph.add_run(f'{letter}  {title}').bold=True
  paragraph.add_run(f'  [{status}]\n{description}')
feature_list(features_first)
page('Daftar fitur N sampai Z')
feature_list(features_second)
page('Mulai menjalankan aplikasi')
step(1,'Buka PowerShell di folder proyek. Jalankan aplikasi menggunakan perintah berikut. Akhiran .cmd menghindari masalah kebijakan PowerShell yang memblokir skrip.')
code('cd "C:\\Users\\didra\\Documents\\WebApp Adeek\\App"\n$env:NEXT_PUBLIC_DATA_MODE="mock"\nnpx.cmd --yes pnpm@11.25.0 dev')
step(2,'Biarkan terminal tetap terbuka. Buka http://127.0.0.1:3000. Pada profil peramban baru, halaman Dokumen Anda akan menampilkan tiga proyek contoh.')
step(3,'Gunakan profil peramban terpisah atau jendela InPrivate untuk pengujian. Proyek simulasi dan preferensi tersimpan di peramban tersebut. Gunakan alamat host dan port yang sama selama satu pengujian.')
shot('01-ledger','Gambar 1  Daftar dokumen awal dalam mode simulasi',3.2)

page('1 Periksa preferensi dan daftar dokumen')
step(1,'Klik ikon roda gigi untuk membuka Pengaturan. Ganti Tema antara Terang, Gelap, dan pengaturan sistem. Buka setiap menu pilihan dan pastikan opsinya tetap terbaca pada kedua tema.')
step(2,'Ubah Bahasa antarmuka menjadi English dan pastikan label berubah. Kembalikan ke Bahasa Indonesia untuk langkah berikutnya. Muat ulang halaman dan pastikan preferensi tetap tersimpan.')
step(3,'Pada Koneksi AI dalam mode simulasi, masukkan nilai uji seperti example-key-local-testing. Simpan pengaturan dan jalankan Uji koneksi simulasi. Hasil harus menyatakan bahwa pengujian bersifat simulasi dan belum memverifikasi penyedia eksternal.')
step(4,'Muat ulang halaman. Kolom kata sandi harus kosong. Kunci simulasi hanya berada di memori dan perlu dimasukkan kembali setelah pemuatan ulang. Gunakan Hapus key untuk menghapus nilai sementara.')
step(5,'Kembali ke Dokumen. Buka contoh rumah sakit, lalu kembali ke daftar. Pastikan judul dan status sesuai. Hindari mengatur ulang peramban yang menyimpan pekerjaan yang ingin dipertahankan.')
shot('11-settings-mock','Gambar 2  Pengaturan AI simulasi dan tampilan',3.8)
p('Pengujian lulus jika kedua tema dan bahasa dapat digunakan, navigasi berhasil, serta koneksi simulasi diberi penjelasan yang jelas. Hasil simulasi bukan bukti bahwa n8n atau DeepSeek menerima permintaan.')

page('2 Buat proyek dari teks dan berkas')
step(1,'Buka /new-project. Isi Nama dokumen dengan Uji panduan klinik mahasiswa. Pertahankan Healthcare sebagai domain dan versi 0.1.')
step(2,'Tempelkan pada Deskripsi sistem: Petugas klinik mendaftarkan pasien mahasiswa dan mengatur jadwal dokter. Hak akses berdasarkan peran. Waktu respons maksimal 2 detik.')
step(3,'Sebelum mengirim, coba kosongkan judul, lalu kosongkan deskripsi secara bergantian. Tombol pembuatan dokumen harus nonaktif sampai kedua isian wajib terisi.')
step(4,'Untuk proyek kedua, unggah PDF kecil dengan teks yang dapat dipilih atau transkrip TXT UTF-8. Buka Tinjau teks hasil ekstraksi, periksa teks, dan perbaiki kesalahan ekstraksi sebelum membuat dokumen. Tambahkan catatan singkat di kolom deskripsi untuk memeriksa penggabungan sumber.')
step(5,'Pada proyek pertama, klik Mulai buat dokumen SRS. Halaman harus beralih ke ruang kerja. Gunakan PDF dengan lapisan teks untuk menguji pembacaan berkas. Dokumen hasil pemindaian memerlukan OCR.')
shot('02-intake','Gambar 3  Isian konteks sebelum pembuatan dokumen',3.8)
p('Pengujian lulus jika berkas terpilih muncul, teks ekstraksi dapat ditinjau, serta catatan dan isi berkas digabungkan menjadi konteks. Pembacaan dan penggabungan PDF telah diuji pada kedua tema.')

page('3 Amati penyusunan dan uji pemulihan')
step(1,'Amati tahapan pada ruang kerja dan bagian yang mulai terisi draf. Tunggu hingga tombol Setujui dan finalisasi aktif. Penyusunan simulasi dapat memerlukan beberapa detik.')
step(2,'Pastikan dokumen memiliki empat bagian IEEE beserta subbagiannya. Buka panel konteks dan kualitas untuk memeriksa contoh potongan sumber yang diambil serta penjelasan pemeriksaan mutu.')
step(3,'Setelah selesai, muat ulang dan buka kembali proyek dari daftar dokumen. Draf dan status proyek harus tetap tersimpan pada profil peramban yang sama.')
step(4,'Untuk menguji pemulihan, buka proyek contoh yang gagal dari daftar awal, lalu pilih Lanjutkan penyusunan. Pendahuluan yang sudah selesai harus tetap tersedia saat bagian berikutnya disusun.')
step(5,'Untuk pengujian kegagalan tambahan, buka alat pengembang dengan Ctrl Shift D. Pilih skenario retrieval, chapter3, guardrail, atau revision, lalu ulangi tindakan terkait. Kegagalan harus terlihat dan dapat dipulihkan. Kembalikan skenario ke none setelah pemeriksaan.')
shot('03-generation','Gambar 4  Progres penyusunan pada ruang kerja simulasi',3.7)
p('Pengujian lulus jika bagian yang selesai tetap tersedia setelah percobaan ulang dan dokumen dapat ditinjau. Ini merupakan pengujian antarmuka simulasi. Pengujian eksekusi workflow live dan penyambungan ulang SSE masih belum selesai.')

page('4 Sunting dan simpan bagian secara manual')
step(1,'Pada ruang kerja dokumen yang baru dibuat, cari bagian 1.1 dan klik Edit. Baca Markdown yang ada sebelum mengubahnya.')
step(2,'Tambahkan paragraf terpisah: Catatan uji manual tersimpan. Klik Selesai mengedit dan pastikan kalimat tersebut muncul pada naskah.')
step(3,'Muat ulang dan periksa kembali kalimat itu. Buka bagian lain dan pastikan teksnya tidak berubah. Penyuntingan manual tidak seharusnya memulai proses pembuatan atau revisi AI.')
step(4,'Periksa ID kebutuhan pada bagian 3.2. Pastikan setiap ID tetap unik saat menambah kebutuhan. Jika antarmuka melaporkan duplikasi, selesaikan sebelum finalisasi.')
step(5,'Gunakan kontrol versi atau riwayat untuk memeriksa versi tersimpan sebelum memulihkannya. Pulihkan hanya konten uji dan pastikan kondisi dokumen sesuai dengan versi yang dipilih.')
shot('05-edit','Gambar 5  Penyuntingan Markdown pada subbagian terpilih',3.8)
p('Pengujian lulus jika kalimat tetap ada setelah pemuatan ulang dan bagian lain tidak berubah. Pengujian otomatis juga memeriksa keberadaan suntingan ini pada berkas Word hasil ekspor. Pemulihan versi merupakan pemeriksaan manual tambahan di luar sepuluh pengujian peramban terpilih yang dilaporkan di sini.')

page('5 Tinjau revisi AI sebelum menerapkannya')
step(1,'Cari bagian 3.4 Security requirements dan klik Revisi AI. Pilih Wajibkan 2-Factor Authentication dan enkripsi AES-256, lalu Kirim revisi.')
step(2,'Tunggu hingga Tinjau usulan revisi muncul. Bandingkan teks awal dan usulan. Pastikan targetnya adalah subbagian 3.4 dan usulan menyebutkan TOTP.')
step(3,'Klik Terapkan perubahan. Pastikan revisi keamanan muncul pada naskah dan kalimat manual pada bagian 1.1 tetap sama.')
step(4,'Ajukan revisi berikutnya dengan Tambahkan audit trail pada autentikasi. Catat teks keamanan sebelum permintaan. Pada dialog hasil revisi, pilih Batalkan. Naskah harus tetap sama seperti sebelum permintaan tersebut.')
step(5,'Untuk menguji pemisahan perubahan, ajukan revisi pada dua bagian berbeda sebelum menerima salah satunya. Terima setiap usulan secara terpisah dan pastikan masing-masing hanya memperbarui bagiannya sendiri.')
shot('06-revision','Gambar 6  Perbandingan dan persetujuan revisi secara eksplisit',3.8)
p('Pengujian lulus jika penerimaan revisi hanya mengubah bagian terpilih dan pembatalan mempertahankan teksnya. Target angka yang disarankan tetap perlu ditinjau penulis. Contoh simulasi bukan bukti penelitian yang bersumber dari data nyata.')

page('6 Finalisasi dan ekspor dokumen')
step(1,'Tinjau draf, peringatan duplikasi, dan penanda mutu yang belum diselesaikan. Klik Setujui dan finalisasi setelah konten siap untuk pengujian ini.')
step(2,'Pada dialog konfirmasi, centang Saya telah meninjau dokumen ini dan pilih Finalisasi dokumen. Halaman ekspor harus terbuka.')
step(3,'Klik Unduh dokumen Word. Buka DOCX yang diunduh dan cari Catatan uji manual tersimpan. Periksa judul bagian, tabel kebutuhan, serta hasil revisi keamanan.')
step(4,'Gunakan tindakan PDF atau cetak yang tersedia. Pada dialog cetak peramban, pilih Save as PDF, tinjau tata letaknya, lalu simpan. Bandingkan judul dan isi dengan berkas Word.')
step(5,'Kembali ke ruang kerja dan pastikan status sudah difinalisasi. Pencetakan peramban tidak membuktikan bahwa kompilator server Pandoc dan LibreOffice yang direncanakan sudah bekerja.')
shot('08-export','Gambar 7  Dokumen yang difinalisasi dan tindakan ekspor',3.8)
p('Pengujian lulus jika berkas Word benar-benar berformat DOCX, dapat dibuka, dan memuat suntingan. Pengunduhan DOCX dan pemeriksaan isinya telah diuji otomatis. Pencetakan PDF melalui peramban dan pemeriksaan tata letak terperinci tetap dilakukan secara manual.')

page('7 Isi formulir kegunaan SUS')
step(1,'Buka /evaluation?tab=sus. Jawaban ini merupakan data uji dalam mode simulasi. Gunakan profil peramban khusus pengujian.')
step(2,'Untuk butir 1, 3, 5, 7, dan 9, pilih 5. Untuk butir 2, 4, 6, 8, dan 10, pilih 1. Kirim menggunakan Kirim jawaban SUS.')
step(3,'Skor yang ditampilkan harus 100.0. Ini adalah pengujian perhitungan dengan jawaban yang ditentukan sebelumnya, bukan hasil peserta sebenarnya.')
step(4,'Muat ulang dan periksa ringkasan evaluasi atau hasil yang tersimpan. Gunakan jawaban berdasarkan pengalaman nyata hanya ketika melaksanakan sesi kegunaan yang sudah dipersiapkan dengan benar.')
step(5,'Pada lebar layar 390 piksel, formulir menampilkan satu butir setiap langkah. Gunakan Berikutnya sampai sepuluh butir selesai, lalu kirim. Skornya harus sama dengan jawaban yang sama pada desktop.')
shot('09-sus','Gambar 8  Hasil pengiriman dan perhitungan SUS',3.8)
p('Pengujian lulus jika seluruh jawaban wajib harus diisi sebelum pengiriman dan pola jawaban uji menghasilkan 100.0. Penyimpanan penelitian live, persetujuan peserta, serta alur kode peserta masih belum selesai. Jangan gunakan hasil simulasi ini dalam skripsi.')

page('8 Uji penilaian pakar tersamar dan tab evaluasi')
step(1,'Pada Evaluasi, pilih Penilaian pakar. Isi Nama samaran penilai dengan Pakar-07.')
step(2,'Tinjau dokumen A tanpa menebak sumbernya. Untuk pengujian mekanis ini, beri nilai 4 pada dimensi tidak ambigu, lengkap, benar, dan dapat diuji. Tulis alasan yang spesifik untuk setiap dimensi.')
step(3,'Klik Kirim penilaian. Tombol harus berubah menjadi Penilaian tersimpan. Ulangi untuk B bila diperlukan oleh rencana penilaian. Pastikan sumber baru diungkap setelah pengiriman, bukan selama pemberian nilai.')
step(4,'Periksa ringkasan, ROUGE, dan bagian hasil statistik. Data impor harus sesuai dengan kontrak di packages/contracts/src/index.ts. Coba sekali berkas JSON tidak valid dan pastikan formulir menampilkan kesalahan tanpa mengganti hasil yang sudah ada.')
step(5,'Ekspor data uji melalui kontrol yang tersedia, lalu periksa label dan nilainya. Data ini berasal dari contoh lokal atau simulasi. Pemeriksaan kesesuaian bahasa ROUGE, statistik, dan ekspor penelitian nyata termasuk tahap backend yang belum selesai.')
shot('10-expert','Gambar 9  Dimensi penilaian pakar dan contoh dokumen tersamar',3.8)
p('Pengujian otomatis terpilih telah memverifikasi pengiriman penilaian pakar dan perhitungan SUS. Kasus khusus impor dan ekspor pada bagian lain merupakan pemeriksaan manual dalam panduan ini, bukan hasil otomatis baru yang diklaim lulus.')

page('9 Periksa tampilan responsif')
step(1,'Gunakan alat pengembang peramban untuk mencoba lebar 1440, 1024, 768, dan 390 piksel. Periksa kembali daftar dokumen, formulir masukan, ruang kerja, dialog revisi, ekspor, serta evaluasi.')
step(2,'Pada setiap lebar, periksa luapan horizontal, tombol terpotong, keterbacaan menu pilihan, fokus papan ketik, dan akses melalui gulir ke seluruh tindakan. Uji tema terang dan gelap.')
step(3,'Pada lebar 390 piksel, buka SUS dan pastikan tepat lima pilihan jawaban terlihat untuk butir aktif. Lanjutkan sampai seluruh sepuluh butir selesai.')
step(4,'Ganti bahasa ke English lalu kembali. Pastikan label panjang membungkus dengan baik dan kunci pesan seperti backendErrors.unknown tidak tampil sebagai teks mentah.')
shot('12-mobile','Gambar 10  Tampilan SUS pada lebar 390 piksel',4.4)
p('Pengujian lulus jika seluruh isi dan tindakan tetap dapat dijangkau tanpa gulir horizontal. Tangkapan layar ini diambil langsung dari aplikasi. Sepuluh pengujian terpilih mencakup alur desktop pada kedua tema, sedangkan daftar pemeriksaan berbagai lebar layar ini tetap merupakan pengujian manual.')

page('10 Jalankan mode live dan periksa Pengaturan')
step(1,'Tekan Ctrl C pada terminal aplikasi. Jalankan penyiapan n8n yang sudah ada dan ganti mode menggunakan perintah berikut. Tetap gunakan alamat peramban lokal yang sama.')
code('docker compose -f "C:\\Users\\didra\\Documents\\n8n-docker\\compose.yaml" start\n$env:NEXT_PUBLIC_DATA_MODE="live"\nnpx.cmd --yes pnpm@11.25.0 dev')
step(2,'Buka /settings secara langsung. Baris DeepSeek, Embeddings, dan n8n harus tersedia. Setelah penyimpanan dan pengujian berhasil, tiga indikator menunjukkan Tersimpan, Tersinkron, dan Teruji. Kunci tersimpan hanya menampilkan petunjuk empat karakter terakhir.')
step(3,'Gunakan konfigurasi penyedia simulasi lokal yang sudah ada untuk pengujian otomatis. Buka pengaturan lanjutan dan periksa URL serta model. Masukkan kunci asli hanya saat sengaja melakukan pengujian manual berbayar pada penyedia nyata.')
step(4,'Untuk menguji pergantian kunci, pilih Ganti kunci dan simpan kunci uji baru pada penyedia simulasi. Kolom kata sandi harus kosong setelah penyimpanan. Jalankan Uji sambungan dan pastikan waktu pengujian berhasil terakhir diperbarui.')
shot('13-settings-live','Gambar 11  Pengaturan live dengan kredensial penyedia tersinkron',3.4)
p('Perubahan URL server mengharuskan kunci dimasukkan kembali. Jangan masukkan kunci asli ke tangkapan layar, panduan, URL, atau laporan masalah. Penghapusan menghilangkan kunci tersimpan; sambungan perlu disimpan kembali dengan kunci baru untuk dipulihkan.')

page('11 Periksa status korpus dan kesiapan sistem')
step(1,'Pada Pengaturan live, gulir ke Basis pengetahuan. Penyiapan pengembangan lokal yang diverifikasi memiliki 150 potongan dengan model text-embedding-3-small berdimensi 1536. Penanda data pengembangan harus terlihat.')
step(2,'Periksa daftar workflow dan gunakan Terapkan ulang sambungan setelah menguji kredensial yang hilang. Tindakan ini membangun ulang kredensial dari penyimpanan terenkripsi. Jangan menghapus volume Docker sebagai pengujian rutin.')
step(3,'Buka /new-project pada mode live. Pembuatan dokumen saat ini tetap nonaktif karena workflow produksi untuk pembuatan, revisi, dan penanganan kesalahan belum selesai. Ikuti tautan Pengaturan pada pemberitahuan kesiapan untuk memeriksa penyebabnya.')
step(4,'Untuk mengulangi verifikasi korpus, jalankan penyedia simulasi lokal pada terminal terpisah, lalu jalankan Python dari akar repositori. Gunakan lingkungan virtual proyek jika sudah dipasang.')
code('node --env-file=apps/web/.env.local tools/mock-llm/server.mjs\n.venv\\Scripts\\python.exe -m ingestion verify --use-app-settings --require-mock')
shot('14-knowledge','Gambar 12  Status korpus pengembangan pada Pengaturan live',3.4)
p('Korpus pengembangan tidak disertakan dalam metrik skripsi. Ekstraksi sumber penelitian dan pemeriksaan lisensi masih perlu ditinjau. Keberhasilan uji sambungan Pengaturan tidak membuktikan bahwa seluruh workflow pembuatan dokumen live sudah tersedia.')

page('12 Atasi masalah dan catat hasil pengujian')
doc.add_heading('Menjalankan aplikasi dan memulihkan layanan',level=2)
p('Jika pnpm tidak dikenali, gunakan npx.cmd --yes pnpm@11.25.0 dev. Jika npx.ps1 diblokir, tetap gunakan akhiran .cmd tanpa mengubah kebijakan eksekusi sistem. Jika port 3000 terpakai, hentikan terminal aplikasi sebelumnya lalu jalankan kembali. Setelah beralih antara mock dan live, mulai ulang server pengembangan dan muat ulang peramban.')
p('Jika n8n tidak tersedia, buka Docker Desktop, jalankan layanan compose yang sudah ada, dan periksa http://localhost:5678/healthz/readiness. Jika Supabase tidak tersedia, dari akar proyek jalankan npx.cmd --yes supabase@3.0.0 start --exclude realtime,imgproxy,edge-runtime,logflare,vector,supavisor. Jangan menggunakan reset atau menghapus volume untuk memperbaiki masalah sambungan.')
p('Jika contoh simulasi hilang, gunakan profil peramban baru atau muat contoh melalui Ctrl Shift D. Atur ulang hanya profil uji yang datanya boleh dihapus karena tindakan ini menghapus proyek lokal. Kesalahan not_implemented pada fitur dokumen atau evaluasi live merupakan keterbatasan tahap pengembangan yang diketahui, bukan masalah konfigurasi kunci.')
doc.add_heading('Perintah untuk mengulangi pemeriksaan',level=2)
code('npx.cmd --yes pnpm@11.25.0 typecheck\nnpx.cmd --yes pnpm@11.25.0 lint\nnpx.cmd --yes pnpm@11.25.0 test\nnpx.cmd --yes pnpm@11.25.0 test:e2e\nnode scripts/doctor.mjs')
p('Jalankan Playwright saat aplikasi memakai mode simulasi. Doctor memeriksa kesiapan backend live dan dapat mengembalikan kode keluar bukan nol selama workflow produksi belum tersedia. Seluruh rangkaian Playwright mencakup lebih banyak kasus daripada sepuluh kasus terpilih dalam panduan ini.')
doc.add_heading('Hasil yang telah diamati',level=2)
p('Sepuluh kasus peramban terpilih lulus pada tema terang dan gelap: pemisahan dua revisi bersamaan; pembuatan dari teks sampai penyuntingan, penerimaan dan penolakan revisi, finalisasi, serta pengunduhan DOCX asli; PDF beserta catatan; pemulihan proses gagal; serta SUS dan pengiriman penilaian pakar. Alur bergambar menggunakan dua belas tangkapan layar simulasi baru. Pengaturan dan kesiapan live diambil secara terpisah.')
p('Pemeriksaan backend sebelumnya meluluskan 43 pengujian TypeScript dan tujuh pengujian Python. Pengujian siklus kredensial melalui n8n dan Supabase lokal yang nyata lulus dengan kunci penyedia uji. Pembuatan dokumen live penuh, ekspor server, API penelitian, serta pengujian menyeluruh mode live masih belum selesai.')
doc.add_heading('Mencatat setiap pengujian manual',level=2)
p('Untuk setiap urutan, catat tanggal, mode, tema, lebar peramban, judul proyek, tindakan, hasil yang diharapkan, hasil sebenarnya, dan status lulus atau gagal. Jika gagal, lampirkan tangkapan layar dengan rahasia disembunyikan, tombol yang ditekan, serta kode kesalahan yang terlihat. Pisahkan hasil simulasi dari pengamatan penelitian.')

for style in doc.styles:
    for border in style.element.findall('.//' + qn('w:pBdr')):
        border.getparent().remove(border)
for paragraph in doc.paragraphs:
    for border in paragraph._p.findall('.//' + qn('w:pBdr')):
        border.getparent().remove(border)
doc.save(OUT/'Naskah_Local_Testing_Guide.docx')
print('Created',OUT/'Naskah_Local_Testing_Guide.docx')

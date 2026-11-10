from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfReader,PdfWriter
out=Path(__file__).resolve().parent;out.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(out/'text.pdf'))
for number in range(1,4):
    text=c.beginText(60,780)
    for line in ['Naskah repeated header',f'Unique section {number}','Sistem harus menyimpan rekam medis pasien.','Petugas harus memeriksa hasil verifikasi.',f'Page {number} of 3']:text.textLine(line)
    c.drawText(text);c.showPage()
c.save()
c=canvas.Canvas(str(out/'scanned.pdf'));c.rect(60,60,150,150,fill=1);c.showPage();c.save()
writer=PdfWriter();writer.append(out/'text.pdf');writer.encrypt('synthetic-test');writer.write(out/'encrypted.pdf')
writer=PdfWriter()
for index in range(201):writer.add_blank_page(595,842)
writer.write(out/'too-many-pages.pdf')
(out/'notes.txt').write_text('Catatan lokal\nSistem harus menyimpan data pasien.\nPage 1\nTeks de-\nngan kontrol\x01.',encoding='utf8',newline='\n')

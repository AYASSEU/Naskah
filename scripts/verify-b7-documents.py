"""Acceptance for synthetic hospital exports; PNG review remains a separate gate."""
import json,re,sys,xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile
from pypdf import PdfReader
import pdfplumber
folder=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/b7')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
q=lambda name:'{'+ns['w']+'}'+name
with ZipFile(folder/'hospital.docx') as archive:
    document=ET.fromstring(archive.read('word/document.xml'))
    styles=ET.fromstring(archive.read('word/styles.xml'))
    for margin in document.findall('.//w:pgMar',ns):
        for side,expected in [('top',2268),('left',2268),('bottom',1701),('right',1701)]:assert abs(int(margin.get(q(side)))-expected)<=1
    for size in document.findall('.//w:pgSz',ns):
        assert abs(int(size.get(q('w')))-11906)<=2
        assert abs(int(size.get(q('h')))-16838)<=2
    assert len(document.findall('.//w:tbl',ns))==3
    text=' '.join(document.itertext())
    assert 'TOC' in text
    for number in range(1,4):assert 'Tabel '+str(number) in text
    normal=next(style for style in styles.findall('w:style',ns) if style.get(q('styleId'))=='Normal')
    assert normal.find('w:rPr/w:rFonts',ns).get(q('ascii'))=='Times New Roman'
    assert normal.find('w:rPr/w:sz',ns).get(q('val'))=='24'
    assert normal.find('w:pPr/w:spacing',ns).get(q('line'))=='360'
    assert all(node.get(q('val'))=='24' for table in document.findall('.//w:tbl',ns) for node in table.findall('.//w:rPr/w:sz',ns))
reader=PdfReader(folder/'hospital.pdf')
pages=[page.extract_text() for page in reader.pages]
assert 8<=len(pages)<=35
assert 'Software Requirements Specification' in pages[0]
assert 'Penulis: Penguji Lokal' in pages[0] and 'Institusi: Naskah' in pages[0]
assert 'Daftar Isi' in pages[1]
toc='\n'.join(pages[1:3])
chapter_pages={}
for number,title in [(1,'Introduction'),(2,'Overall Description'),(3,'Specific Requirements'),(4,'Supporting Artifacts')]:
    match=re.search(str(number)+r'\s+'+title+r'\.+\s*(\d+)',toc)
    assert match,(title,'missing TOC page')
    page=int(match.group(1));assert 1<page<=len(pages)
    assert re.search(str(number)+r'\s+'+title,pages[page-1])
    chapter_pages[title]=page
assert '3.1.1' in toc and '4.1.1' in toc
all_text='\n'.join(pages)
expected_ids={int(n) for n in re.findall(r'REQ-F-(\d+)',Path('tests/fixtures/markdown/phase1-1.md').read_text(encoding='utf8'))}
assert expected_ids=={int(n) for n in re.findall(r'REQ-F-(\d+)',all_text)}
assert '<!-- naskah:' not in all_text
with pdfplumber.open(folder/'hospital.pdf') as pdf:
    for index,page in enumerate(pdf.pages):
        assert abs(page.width-595.3)<1 and abs(page.height-841.89)<1
        assert page.chars
        assert min(c['x0'] for c in page.chars)>100
        assert max(c['x1'] for c in page.chars)<page.width-70
        assert str(index+1) in (page.extract_text().splitlines()[-1])
report={'pages':len(pages),'tables':3,'requirements':len(expected_ids),'margins_cm':{'top':4,'left':4,'right':3,'bottom':3},'font':'Times New Roman 12 pt','line_spacing':1.5,'toc':chapter_pages,'passed':True}
(folder/'document-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))

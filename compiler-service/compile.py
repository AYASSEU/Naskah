"""Pandoc AST -> IEEE DOCX -> refreshed UNO DOCX and PDF, isolated per job."""
import sys,json,subprocess,socket,time,os,zipfile,re
from pathlib import Path
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm,Pt
import uno
from com.sun.star.beans import PropertyValue
job=Path(sys.argv[1]);data=json.loads((job/'input.json').read_text())
def prop(name,value):
    p=PropertyValue();p.Name=name;p.Value=value;return p
try:
    source=re.sub(r'<!--.*?-->','',data['markdown'],flags=re.S)
    source=re.sub(r'<br\s*/?>',' ',source,flags=re.I)
    ast=json.loads(subprocess.run(['pandoc','--sandbox','-f','gfm-raw_html','-t','json'],input=source,text=True,capture_output=True,check=True,timeout=15).stdout)
    def sanitize(node):
        if isinstance(node,dict):
            if node.get('t') in ['Image','RawBlock','RawInline']:raise ValueError('unsafe_document')
            if node.get('t')=='Header':
                # Replace only the existing numeric prefix; Pandoc numbers the
                # same heading tree once, including requirement-level headings.
                inlines=node['c'][2]
                if inlines and inlines[0].get('t')=='Str' and re.fullmatch(r'\d+(?:\.\d+)*\.?',inlines[0]['c']):
                    del inlines[0]
                    if inlines and inlines[0].get('t')=='Space':del inlines[0]
            for value in node.values():sanitize(value)
        elif isinstance(node,list):
            for value in node:sanitize(value)
    sanitize(ast)
    metadata=data['metadata']
    ast['meta']={key:{'t':'MetaString','c':value} for key,value in {'title':metadata['title'],'subtitle':metadata['project'],'author':metadata['author'],'date':metadata['date'],'toc-title':'Daftar Isi'}.items()}
    # Debian Pandoc 2.17 cannot read embedded DOCX resources under --sandbox.
    # Its writer receives only the validated AST, without images/raw nodes.
    subprocess.run(['pandoc','-f','json','-t','docx','--standalone','--toc','--toc-depth=3','--number-sections','--lua-filter=/app/format.lua','--reference-doc=/app/template_ieee830.docx','-o',str(job/'draft.docx')],input=json.dumps(ast),text=True,capture_output=True,check=True,timeout=20)
    doc=Document(job/'draft.docx')
    # Cover fields are paragraphs, never interpreted as Markdown/HTML.
    first=doc.paragraphs[0]
    # Metadata author/date are placed by Pandoc; version/institution need explicit fields.
    anchor=next((p for p in doc.paragraphs if p.style.name=='Subtitle'),first)
    for label,value in reversed([('Versi',metadata['version']),('Penulis',metadata['author'] or '-'),('Institusi',metadata['institution'] or '-'),('Tanggal',metadata['date'])]):
        p=OxmlElement('w:p');anchor._p.addnext(p)
        from docx.text.paragraph import Paragraph
        para=Paragraph(p,anchor._parent);para.alignment=1;para.add_run(label+': '+value)
    # Remove duplicate Pandoc metadata author/date paragraphs.
    for p in list(doc.paragraphs):
        if p.style.name in ['Author','Date']:p._element.getparent().remove(p._element)
    for table in doc.tables:
        table.autofit=False
        table._tbl.tblPr.append(OxmlElement('w:tblBorders'))
        borders=table._tbl.tblPr.find(qn('w:tblBorders'))
        for edge in ['top','left','bottom','right','insideH','insideV']:
            el=OxmlElement('w:'+edge);el.set(qn('w:val'),'single');el.set(qn('w:sz'),'4');el.set(qn('w:color'),'D9D9D9');borders.append(el)
        for index,row in enumerate(table.rows):
            if index==0:row._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
            for cell in row.cells:
                cell.vertical_alignment=1
                if index==0:
                    shading=OxmlElement('w:shd');shading.set(qn('w:fill'),'EEEEEE');cell._tc.get_or_add_tcPr().append(shading)
                for p in cell.paragraphs:
                    p.paragraph_format.line_spacing=1.5;p.paragraph_format.space_after=Pt(4);p.paragraph_format.space_before=Pt(4)
                    for run in p.runs:run.font.size=Pt(12)
    doc.save(job/'draft.docx')
    listener=socket.socket();listener.bind(('127.0.0.1',0));port=listener.getsockname()[1];listener.close()
    office=subprocess.Popen(['libreoffice','-env:UserInstallation='+ (job/'profile').as_uri(),'--headless','--norestore','--nodefault','--nofirststartwizard',f'--accept=socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    document=None
    try:
        local=uno.getComponentContext();resolver=local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver',local)
        for attempt in range(100):
            try:context=resolver.resolve(f'uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext');break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('office_unavailable')
        desktop=context.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop',context)
        document=desktop.loadComponentFromURL((job/'draft.docx').as_uri(),'_blank',0,(prop('Hidden',True),prop('ReadOnly',False),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)))
        document.refresh()
        for _ in range(2):
            indexes=document.getDocumentIndexes()
            for index in range(indexes.getCount()):indexes.getByIndex(index).update()
            document.getTextFields().refresh()
        document.storeAsURL((job/'document.docx').as_uri(),(prop('FilterName','Office Open XML Text'),prop('Overwrite',True)))
        document.storeToURL((job/'document.pdf').as_uri(),(prop('FilterName','writer_pdf_Export'),prop('Overwrite',True)))
    finally:
        if document:document.close(True)
        office.terminate()
        try:office.wait(timeout=5)
        except subprocess.TimeoutExpired:office.kill();office.wait()
    for name in ['document.docx','document.pdf']:
        if (job/name).stat().st_size>25*1024*1024:raise ValueError('too_large')
    with zipfile.ZipFile(job/'output.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name in ['document.docx','document.pdf']:archive.write(job/name,name)
except Exception as error:
    if os.environ.get('NASKAH_COMPILER_DIAGNOSTIC')=='1':
        import traceback
        traceback.print_exc()
        if isinstance(error,subprocess.CalledProcessError):print(error.stderr,file=sys.stderr)
    print(json.dumps({'error':str(error) if str(error) in ['unsafe_document','too_large'] else 'compiler_failed'}));sys.exit(1)

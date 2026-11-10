"""Reproducible IEEE 830 Word reference, without proprietary font binaries."""
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.style import WD_STYLE_TYPE
import subprocess
subprocess.run(['pandoc','--print-default-data-file','reference.docx'],stdout=open('/app/default.docx','wb'),check=True)
doc=Document('/app/default.docx')
for section in doc.sections:
    section.page_width=Cm(21); section.page_height=Cm(29.7)
    section.top_margin=Cm(4); section.left_margin=Cm(4)
    section.right_margin=Cm(3); section.bottom_margin=Cm(3)
    section.footer_distance=Cm(1.5)
    p=section.footer.paragraphs[0]; p.alignment=1
    field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');p._p.append(field)
for style in doc.styles:
    if style.type==WD_STYLE_TYPE.PARAGRAPH:
        style.font.name='Times New Roman';style.font.size=Pt(12);style.font.color.rgb=RGBColor(0,0,0)
        style.paragraph_format.line_spacing=1.5
        style.paragraph_format.space_after=Pt(6)
        style.paragraph_format.widow_control=True
def style_named(name):
    key=name.replace(' ','').lower()
    return next((s for s in doc.styles if s.style_id.replace(' ','').lower()==key),None) or doc.styles.add_style(name,WD_STYLE_TYPE.PARAGRAPH)
for name,size in [('Title',22),('Subtitle',16),('Heading 1',16),('Heading 2',14),('Heading 3',12)]:
    style=style_named(name);style.font.size=Pt(size);style.font.bold=True
    style.paragraph_format.keep_with_next=True
style_named('Heading 1').paragraph_format.page_break_before=True
style_named('TOC Heading').paragraph_format.page_break_before=True
doc.styles['Title'].paragraph_format.space_before=Pt(60)
doc.styles['Title'].paragraph_format.alignment=1
doc.styles['Subtitle'].paragraph_format.alignment=1
doc.save('/app/template_ieee830.docx')

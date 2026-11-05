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
doc.core_properties.title='Naskah local webapp testing guide'
doc.core_properties.subject='Sequential UI testing and live backend connection checks'
doc.core_properties.author='Naskah project'
footer=s.footer.paragraphs[0];footer.alignment=2
footer.add_run('Naskah testing guide  |  ')
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

doc.add_paragraph('Naskah local webapp testing guide','Title')
p('A sequential walkthrough for testing the current application on Windows. Follow the mock-mode journey first, then check the live Settings integration. UI button names are kept in Indonesian so you can match the screenshots directly.')
p('Verified 5 November 2026. Baseline source commit ad08a86 in AYASSEU/Naskah. The complete document workflow currently runs in mock mode. Live mode supports encrypted integration settings, n8n credential synchronization and corpus status; generation, revision, compiler and research services are still being built.')
doc.add_heading('Start the application',level=2)
step(1,'Open PowerShell in the project folder. Start the app with these commands. The .cmd suffix avoids the disabled PowerShell script-policy problem.')
code('cd "C:\\Users\\didra\\Documents\\WebApp Adeek\\App"\n$env:NEXT_PUBLIC_DATA_MODE="mock"\nnpx.cmd --yes pnpm@11.25.0 dev')
step(2,'Keep that terminal open. Browse to http://127.0.0.1:3000. Expect the Dokumen Anda page and three example projects in a fresh browser profile.')
step(3,'Use a separate browser profile or InPrivate window for tests. Mock projects and preferences are stored in that browser. Use the same host and port throughout a test.')
shot('01-ledger','Figure 1  Starting document ledger in mock mode',3.2)

page('1 Check preferences and the document list')
step(1,'Click the gear icon to open Pengaturan. Change Tema between Terang, Gelap and the system setting. Open each dropdown and confirm its choices remain readable in both themes.')
step(2,'Change Bahasa antarmuka to English, confirm labels change, then return to Bahasa Indonesia for the remaining steps. Refresh and confirm the preference persists.')
step(3,'In mock Koneksi AI, enter a dummy value such as example-key-local-testing. Save settings and run Uji koneksi simulasi. Expect an explicit simulation message; it does not verify an external provider.')
step(4,'Refresh. The password field must be empty. Mock keys remain in memory only and must be entered again after reload. Use Hapus key to remove the temporary value.')
step(5,'Return to Dokumen. Open the hospital example and return to the list. Confirm the title and status match. Avoid resetting an existing browser containing work you want to keep.')
shot('11-settings-mock','Figure 2  Mock AI settings and appearance controls',3.8)
p('Pass when both themes and languages are usable, navigation succeeds, and the mock connection is clearly labeled simulated. A simulation result is not evidence that n8n or DeepSeek received a request.')

page('2 Create a project from text and a file')
step(1,'Open /new-project. Fill Nama dokumen with Uji panduan klinik mahasiswa. Keep Healthcare as the domain and version 0.1.')
step(2,'Paste this into Deskripsi sistem: Petugas klinik mendaftarkan pasien mahasiswa dan mengatur jadwal dokter. Hak akses berdasarkan peran. Waktu respons maksimal 2 detik.')
step(3,'Before submitting, leave the title empty once and then the description empty once. The generation button should be disabled until both required inputs exist.')
step(4,'For a second project, upload a small PDF with selectable text or a UTF-8 TXT transcript. Open Tinjau teks hasil ekstraksi, inspect the text and correct extraction errors before generation. Add a short textarea note to check merging.')
step(5,'For the first project, click Mulai buat dokumen SRS. Expect navigation to a workspace. Use a PDF with a text layer for the parser check; a scanned image document requires OCR.')
shot('02-intake','Figure 3  Filled text intake before generation',3.8)
p('Pass when the selected file appears, extracted text can be reviewed, and notes plus file content are included in the context. File parsing and merging were tested in both themes.')

page('3 Observe generation and test recovery')
step(1,'Watch the workspace stages and the sections filling with draft content. Wait until Setujui dan finalisasi becomes enabled. Mock generation may take several seconds.')
step(2,'Check that the document has the four IEEE parts and their subsections. Open the context and quality panels to inspect example retrieved chunks and guardrail explanations.')
step(3,'Refresh after completion and reopen the project from the ledger. The draft and project status should persist in the same browser profile.')
step(4,'For recovery, open the failed example project from the initial ledger and choose Lanjutkan penyusunan. Its completed introduction must remain present while later parts finish.')
step(5,'For optional failure testing, open developer tools with Ctrl Shift D. Select retrieval, chapter3, guardrail or revision as the failure scenario and repeat the relevant action. Expect a visible failure and recoverable state; restore none after the check.')
shot('03-generation','Figure 4  Generation progress in the mock workspace',3.7)
p('Pass when completed sections survive retry and the document becomes reviewable. These are mock UI tests; live workflow execution and SSE reconnect acceptance are still pending.')

page('4 Edit and save a section manually')
step(1,'In the newly generated workspace, locate section 1.1 and click Edit. Read its Markdown before changing it.')
step(2,'Append a separate paragraph: Catatan uji manual tersimpan. Click Selesai mengedit and confirm the sentence appears in the rendered manuscript.')
step(3,'Refresh and check the sentence again. Open another section and confirm its text is unchanged. Manual editing should not start a generation or revision operation.')
step(4,'Inspect requirement IDs in section 3.2. Keep IDs unique when adding a requirement. If the UI reports a duplicate, resolve it before finalization.')
step(5,'Use the version or history controls to inspect available saved versions before restoring one. Restore only test content and confirm the intended document state is shown.')
shot('05-edit','Figure 5  Markdown editing within the selected subsection',3.8)
p('Pass when the exact sentence survives reload and unrelated sections remain unchanged. The automated journey also checks the exported Word file for this manual edit. Version restoration is an additional manual check, not part of the ten selected browser tests reported here.')

page('5 Review an AI revision before accepting it')
step(1,'Locate section 3.4 Security requirements and click Revisi AI. Choose Wajibkan 2-Factor Authentication dan enkripsi AES-256, then Kirim revisi.')
step(2,'Wait for Tinjau usulan revisi. Inspect the original and proposed text. Confirm that the target subsection is 3.4 and that the proposal mentions TOTP.')
step(3,'Click Terapkan perubahan. Confirm the revised security content appears in the manuscript and your manual sentence in 1.1 remains unchanged.')
step(4,'Request another revision using Tambahkan audit trail pada autentikasi. Record the current security text first. In the resulting review dialog choose Batalkan; the manuscript must remain exactly as it was before that request.')
step(5,'For isolation testing, request revisions for two different sections before accepting either. Accept each proposal separately and check that each updates its own section.')
shot('06-revision','Figure 6  Explicit comparison and acceptance of a revision',3.8)
p('Pass when accepting changes only the selected section and cancelling leaves its text unchanged. A suggested numeric target still needs author review; mock examples are not grounded research evidence.')

page('6 Finalize and export the document')
step(1,'Review the draft, duplicate warnings and unresolved quality markers. Click Setujui dan finalisasi only after the content is ready for this test.')
step(2,'In the confirmation dialog tick Saya telah meninjau dokumen ini and choose Finalisasi dokumen. Expect the export page.')
step(3,'Click Unduh dokumen Word. Open the downloaded DOCX and search for Catatan uji manual tersimpan. Check section headings, requirement tables and the revised security text.')
step(4,'Use the PDF or print action available on the page. In the browser print dialog select Save as PDF, preview the layout and save it. Compare headings and content with the Word file.')
step(5,'Return to the workspace and confirm the finalized status. Do not treat browser print as verification of the future server-side Pandoc and LibreOffice compiler.')
shot('08-export','Figure 7  Finalized document and export actions',3.8)
p('Pass when Word downloads as an actual DOCX, opens and includes the edit. DOCX download and content were automated; browser PDF printing and detailed page-layout review remain manual checks.')

page('7 Complete the SUS usability form')
step(1,'Open /evaluation?tab=sus. This is test feedback in mock mode; use a browser profile reserved for testing.')
step(2,'For items 1, 3, 5, 7 and 9 choose 5. For items 2, 4, 6, 8 and 10 choose 1. Submit with Kirim jawaban SUS.')
step(3,'Expect a displayed score of 100.0. This is a scoring test with predetermined answers, not a real participant result.')
step(4,'Reload and inspect the evaluation overview or stored result. Repeat with natural answers only when carrying out a properly prepared usability session.')
step(5,'At a mobile width of 390 pixels the form presents one item at a time. Use Berikutnya until all ten are complete, then submit. The score should match the same desktop answers.')
shot('09-sus','Figure 8  Submitted SUS form and scoring result',3.8)
p('Pass when submission waits for all required answers and the golden answer pattern gives 100.0. The current live research persistence, consent and participant-code flow is unfinished; do not use this mock result in the thesis.')

page('8 Try the blind expert review and evaluation tabs')
step(1,'On Evaluasi, select Penilaian pakar. Enter the pseudonym Pakar-07 in Nama samaran penilai.')
step(2,'Review document A without trying to infer its source. Rate unambiguous, complete, correct and verifiable as 4 for this mechanical test. Provide a specific justification for each dimension.')
step(3,'Click Kirim penilaian. Expect Penilaian tersimpan. Repeat for B if required by your review plan. Check that source disclosure follows submission rather than appearing during rating.')
step(4,'Inspect the overview, ROUGE and statistical-results tabs. Imported data must match the contracts in packages/contracts/src/index.ts. Try an invalid JSON file once and confirm the form shows an error without replacing existing results.')
step(5,'Export any test data using the available controls, then check row labels and values. These are local fixture or simulated results. Real ROUGE language guards, statistics and research exports belong to the unfinished backend stages.')
shot('10-expert','Figure 9  Expert review dimensions and blinded example content',3.8)
p('The selected automated test verified an expert submission and SUS scoring. Import/export edge cases in the other tabs are manual checks in this guide, not newly claimed automated results.')

page('9 Check the responsive interface')
step(1,'Use browser developer tools to test widths 1440, 1024, 768 and 390 pixels. Repeat the ledger, intake, workspace, revision dialog, export and evaluation views.')
step(2,'At each width inspect horizontal overflow, clipped buttons, readable dropdown options, keyboard focus and scroll access to every action. Test light and dark themes.')
step(3,'At 390 pixels open SUS and verify that exactly five answer options are visible for the current item. Advance through all ten questions.')
step(4,'Switch language to English and back. Confirm long labels wrap and no message keys such as backendErrors.unknown are displayed as raw text.')
shot('12-mobile','Figure 10  Mobile SUS layout at 390 pixels',4.4)
p('Pass when all content and actions remain reachable without horizontal scrolling. This screenshot is newly captured; the ten selected tests cover desktop flows in two themes, while this broader viewport checklist remains a manual acceptance pass.')

page('10 Start live mode and inspect Settings')
step(1,'In the app terminal press Ctrl C. Start the existing n8n setup and switch mode with the commands below. Keep using the same local browser address.')
code('docker compose -f "C:\\Users\\didra\\Documents\\n8n-docker\\compose.yaml" start\n$env:NEXT_PUBLIC_DATA_MODE="live"\nnpx.cmd --yes pnpm@11.25.0 dev')
step(2,'Open /settings directly. You should see DeepSeek, Embeddings and n8n rows. After a successful save/test the three indicators are Tersimpan, Tersinkron and Teruji. Saved keys show only a four-character hint.')
step(3,'Use the existing local mock-provider configuration for automated tests. Open advanced settings and inspect its URL and model. Enter real keys only when intentionally performing a paid manual provider test.')
step(4,'To test rotation, choose Ganti kunci and save a fresh dummy key against the mock provider. Expect the password field to clear after saving. Test Uji sambungan and confirm its successful-test timestamp updates.')
shot('13-settings-live','Figure 11  Live Settings with synchronized provider credentials',3.4)
p('Changing the server URL requires key re-entry. Never put an actual key into a screenshot, guide, URL or issue report. Deletion removes the stored key and requires a new save to restore that connection.')

page('11 Check corpus status and readiness')
step(1,'In live Settings scroll to Basis pengetahuan. The verified local development setup contains 150 chunks using text-embedding-3-small at 1536 dimensions. Its development-data banner must be visible.')
step(2,'Check the workflow list and use Terapkan ulang sambungan after a missing-credential test. It rebuilds credentials from the encrypted store; do not delete Docker volumes as a routine test.')
step(3,'Open /new-project in live mode. Generation currently remains disabled because the production generation/revision/error workflows are unfinished. Follow the Settings links in the readiness notice to inspect the reported reasons.')
step(4,'To repeat corpus verification, start the local mock provider in a separate terminal, then use Python from the repository root. Use the project virtual environment if installed.')
code('node --env-file=apps/web/.env.local tools/mock-llm/server.mjs\n.venv\\Scripts\\python.exe -m ingestion verify --use-app-settings --require-mock')
shot('14-knowledge','Figure 12  Development corpus status in live Settings',3.4)
p('The development corpus is excluded from thesis metrics. Research extraction and licensing review is still required. Do not interpret a successful Settings smoke as proof that the full live generation workflow exists.')

page('12 Diagnose problems and record test results')
doc.add_heading('Startup and recovery',level=2)
p('pnpm is not recognized: use npx.cmd --yes pnpm@11.25.0 dev. If npx.ps1 is blocked, keep the .cmd suffix; changing the system execution policy is unnecessary. Port 3000 busy: stop the previous app terminal, then restart. After switching mock/live, restart the development server and reload the browser.')
p('n8n unavailable: open Docker Desktop, start the existing compose services and check http://localhost:5678/healthz/readiness. Supabase unavailable: from the project root run npx.cmd --yes supabase@3.0.0 start --exclude realtime,imgproxy,edge-runtime,logflare,vector,supavisor. Never use reset or delete a volume to resolve a connection problem.')
p('Mock examples missing: use a fresh browser profile, or load examples from Ctrl Shift D. Only reset a disposable test profile; reset deletes its local project data. A live not_implemented error on document/evaluation features is a known phase limitation, not a key configuration problem.')
doc.add_heading('Commands for reproducible checks',level=2)
code('npx.cmd --yes pnpm@11.25.0 typecheck\nnpx.cmd --yes pnpm@11.25.0 lint\nnpx.cmd --yes pnpm@11.25.0 test\nnpx.cmd --yes pnpm@11.25.0 test:e2e\nnode scripts/doctor.mjs')
p('Run Playwright against the mock-mode app. The doctor checks live backend readiness and can correctly return a nonzero exit code while production workflows remain absent. The full Playwright suite includes more cases than the selected ten run for this guide.')
doc.add_heading('Observed results',level=2)
p('All ten selected browser cases passed in light and dark: concurrent revision isolation; text creation through editing, revision acceptance/rejection, finalization and real DOCX download; PDF plus notes; failed-run recovery; SUS plus expert submission. The illustrated walkthrough captured twelve fresh mock screenshots. Live Settings and readiness screenshots were captured separately.')
p('Backend checks previously passed 43 TypeScript tests and seven Python tests. Credential lifecycle checks through real local n8n and Supabase passed with dummy provider keys. Full live generation, server exports, research APIs and live end-to-end acceptance remain pending.')
doc.add_heading('Record each manual test',level=2)
p('For each sequence record: date, mode, theme, browser width, project title, action, expected result, actual result and pass/fail. For a failure attach a screenshot with secrets hidden, the exact button pressed and the visible error code. Keep mock results separate from research observations.')

for style in doc.styles:
    for border in style.element.findall('.//' + qn('w:pBdr')):
        border.getparent().remove(border)
for paragraph in doc.paragraphs:
    for border in paragraph._p.findall('.//' + qn('w:pBdr')):
        border.getparent().remove(border)
doc.save(OUT/'Naskah_Local_Testing_Guide.docx')
print('Created',OUT/'Naskah_Local_Testing_Guide.docx')

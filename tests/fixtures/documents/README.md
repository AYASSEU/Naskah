# Synthetic parser fixtures

`text.pdf` has three text pages with a repeating header and page footer.
`scanned.pdf` has drawing content without text. `encrypted.pdf` uses the dummy
password `synthetic-test`. `too-many-pages.pdf` has 201 blank pages. `notes.txt`
has hard wrapping, a page label and a control character. No real user data is
included. Regenerate with `python tests/fixtures/documents/generate.py` using
ReportLab and pypdf. Tests compare parsed content, not PDF creation timestamps.

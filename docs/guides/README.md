# Local testing guide

Open [the illustrated Word guide](Naskah_Local_Testing_Guide.docx) for sequential tests, expected results and screenshots. The guide covers the full mock UI journey and the currently implemented live Settings/corpus checks. It explicitly identifies unfinished live backend features.

Start the local UI from the repository root in PowerShell:

```powershell
$env:NEXT_PUBLIC_DATA_MODE="mock"
npx.cmd --yes pnpm@11.25.0 dev
```

Open http://127.0.0.1:3000 and keep that terminal running. Mock UI tests need no provider keys. To inspect live connections, stop the server, change the mode to `live`, restart and open `/settings` directly. Live document generation remains pending.

Verification for this guide: ten selected Playwright journeys passed across light and dark themes on 5 November 2026. The guide separates those observed results from additional manual checks. Screenshots were captured from the running local app. The screenshot capture script uses a fresh isolated browser context and dummy test content.

To recreate screenshots with the mock-mode app running, use `node scripts/capture-test-guide.mjs`. Restart in live mode and run `node scripts/capture-test-guide.mjs --live` for Settings screenshots. Run `scripts/create-testing-guide.py` with the bundled document runtime to rebuild the guide. Its source images are also committed under `screenshots/`. The Word file embeds its screenshots; no extra files are needed to read it.

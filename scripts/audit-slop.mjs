import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = 'apps/web/src';
const failures = [];
const checks = [
  [
    'default primary font',
    /font-family\s*:[^;]*(?:\bInter\b|\bRoboto\b|\bArial\b|\bGeist\b|\bsystem-ui\b)/i,
  ],
  [
    'decorative gradient',
    /bg-gradient-|(?:linear|radial)-gradient\(|bg-clip-text|background-clip:\s*text/,
  ],
  ['decorative blur', /backdrop-blur|backdrop-filter/],
  [
    'default palette',
    /\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/,
  ],
  ['looping animation', /animate-(?:pulse|bounce|ping)|animation:[^;}]*\binfinite\b/],
  [
    'placeholder content',
    /lorem ipsum|John Doe|Jane Doe|Acme Corp|seamless|revolutionize|supercharge|unlock the power|10,000\+|99\.9%/i,
  ],
  ['emoji', /\p{Extended_Pictographic}/u],
  ['tracked uppercase eyebrow', /uppercase[^"\n]*tracking-|tracking-[^"\n]*uppercase/],
  ['unapproved full radius', /\brounded-full\b/],
];
async function scan(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, file.name);
    if (file.isDirectory()) await scan(name);
    else if (/\.(css|tsx?|json)$/.test(name)) {
      const content = await readFile(name, 'utf8');
      for (const [label, pattern] of checks)
        if (pattern.test(content)) failures.push(`${name}: ${label}`);
      if (!name.endsWith('tokens.css') && /#[0-9a-f]{6}\b/i.test(content))
        failures.push(`${name}: raw hex color outside tokens.css`);
      if (
        /className=["'][^"']*card[^"']*["']/g.test(content) &&
        (content.match(/className=["'][^"']*card/g) || []).length >= 3
      )
        failures.push(`${name}: repeated card surfaces`);
    }
  }
}
await scan(root);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Design audit passed: fonts, semantic colors, motion, content, and surfaces.');

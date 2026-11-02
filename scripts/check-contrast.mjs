import { readFile } from 'node:fs/promises';
const css = await readFile('apps/web/src/shared/styles/tokens.css', 'utf8');
const blocks = css.split('[data-theme="dark"]');
function luminance(hex) {
  const rgb = hex
    .match(/[a-f0-9]{2}/gi)
    .map((c) => parseInt(c, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
let failures = 0;
for (const [i, block] of blocks.entries()) {
  const tokens = Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
  const pairs = [
    ['ink', 'bg'],
    ['ink', 'surface-1'],
    ['ink', 'surface-2'],
    ['ink-2', 'bg'],
    ['ink-2', 'surface-1'],
    ['ink-3', 'bg'],
    ['ink-3', 'surface-1'],
    ['ink-3', 'surface-2'],
    ['gold-text', 'surface-1'],
    ['on-gold', 'gold'],
    ['positive', 'surface-1'],
    ['danger', 'surface-1'],
    ['paper-ink', 'paper'],
  ];
  for (const [fg, bg] of pairs) {
    const a = luminance(tokens[fg]);
    const b = luminance(tokens[bg]);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) {
      console.error(`${i ? 'Dark' : 'Light'} ${fg} / ${bg}: ${ratio.toFixed(2)} < 4.5`);
      failures++;
    }
  }
}
if (failures) process.exitCode = 1;
else console.log('All 26 declared text pairings meet WCAG AA (4.5:1).');

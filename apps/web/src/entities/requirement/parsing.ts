import type { Requirement } from '@naskah/contracts';
export function parseRequirements(markdown: string): Requirement[] {
  return [
    ...markdown.matchAll(
      /\*\*(REQ-[A-Z]-\d+)\s*[—:-]\s*(.+?)\*\*\s*\n([^]*?)(?=\n\*\*REQ-|\n##|$)/g,
    ),
  ].map((m) => ({
    id: m[1]!,
    title: m[2]!,
    description: m[3]!.trim(),
    actor: 'Pengguna terdaftar',
    input: 'Data tervalidasi',
    process: 'Validasi dan penyimpanan',
    output: 'Konfirmasi tercatat',
    priority: m[3]!.includes('[Medium]') ? 'Medium' : m[3]!.includes('[Low]') ? 'Low' : 'High',
  }));
}
export function duplicateIds(markdown: string) {
  const ids = [...markdown.matchAll(/\bREQ-[A-Z]-\d+\b/g)].map((m) => m[0]);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}
export function nextId(markdown: string) {
  const ids = [...markdown.matchAll(/REQ-F-(\d+)/g)].map((m) => Number(m[1]));
  return `REQ-F-${String(Math.max(0, ...ids) + 1).padStart(2, '0')}`;
}

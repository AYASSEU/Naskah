import { z } from 'zod';
import { RougeSchema } from '@naskah/contracts';
export function csvRecords(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else value += c;
  }
  if (quoted) throw new Error('Unterminated CSV field');
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const headers = (rows.shift() || []).map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] || ''])));
}
export function parseRougeImport(text: string, format: 'json' | 'csv') {
  const data =
    format === 'json'
      ? JSON.parse(text)
      : csvRecords(text).map((row) => ({
          scenario: row.scenario,
          ...Object.fromEntries(
            ['rouge1', 'rouge2', 'rougeL'].map((metric) => [
              metric,
              row[metric]
                ? JSON.parse(row[metric])
                : Object.fromEntries(
                    ['precision', 'recall', 'f1'].map((key) => [
                      key,
                      Number(row[`${metric}.${key}`]),
                    ]),
                  ),
            ]),
          ),
        }));
  return z.array(RougeSchema).parse(data);
}

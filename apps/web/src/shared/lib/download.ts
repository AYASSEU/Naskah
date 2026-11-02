export function downloadData(data: unknown, name: string, format: 'json' | 'csv') {
  const records = Array.isArray(data) ? data : [data];
  const keys = Object.keys(records[0] || {});
  const cell = (v: unknown) =>
    `"${String(typeof v === 'object' ? JSON.stringify(v) : (v ?? '')).replaceAll('"', '""')}"`;
  const text =
    format === 'json'
      ? JSON.stringify(data, null, 2)
      : '\uFEFF' +
        [
          keys.map(cell).join(','),
          ...records.map((row) => keys.map((k) => cell(row[k])).join(',')),
        ].join('\r\n');
  const url = URL.createObjectURL(
    new Blob([text], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

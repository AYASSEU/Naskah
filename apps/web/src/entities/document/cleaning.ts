export function cleanPages(pages: string[]) {
  const counts = new Map<string, number>();
  for (const page of pages)
    for (const line of new Set(
      page
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    ))
      counts.set(line, (counts.get(line) || 0) + 1);
  let removed = 0;
  const before = pages.join('\n').length;
  const text = pages
    .map((page) =>
      page
        .split('\n')
        .filter((line) => {
          const l = line.trim();
          const remove =
            /^(?:page\s*)?\d+(?:\s*of\s*\d+)?$/i.test(l) ||
            (pages.length > 1 && (counts.get(l) || 0) > pages.length / 2 && l.length < 120);
          if (remove) removed++;
          return !remove;
        })
        .join('\n'),
    )
    .join('\n\n')
    // Control characters are intentionally removed from extracted PDF/TXT content.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g, '')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/([^\n])\n(?=[^\n#|*\d-])/g, '$1 ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, pages: pages.length, before, after: text.length, removed };
}
export function mergeSources(notes: string, files: { name: string; text: string }[]) {
  return [notes.trim(), ...files.map((f) => `\n--- Sumber: ${f.name} ---\n${f.text}`)]
    .filter(Boolean)
    .join('\n\n');
}

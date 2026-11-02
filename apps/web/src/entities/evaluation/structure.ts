import { ieeeTemplate } from '../template/ieee';
export function checkStructure(markdown: string) {
  const headings = ieeeTemplate.chapters.flatMap((c) => [
    { number: c.number, title: c.title },
    ...c.subsections.filter((s) => s.required),
  ]);
  const missing = headings.filter(
    (h) => !new RegExp(`^#{1,4}\\s+${h.number.replaceAll('.', '\\.')}[\\s.]`, 'm').test(markdown),
  );
  return {
    percentage: Math.round(((headings.length - missing.length) / headings.length) * 100),
    missing,
  };
}

export { scoreSus } from '@naskah/core';
export function statistics(values: number[]) {
  const mean = values.reduce((s, n) => s + n, 0) / (values.length || 1);
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean,
    median: sorted.length
      ? (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2
      : 0,
    sd: Math.sqrt(values.reduce((s, n) => s + (n - mean) ** 2, 0) / Math.max(1, values.length - 1)),
  };
}

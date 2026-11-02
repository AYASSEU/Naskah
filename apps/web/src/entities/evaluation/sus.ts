export function scoreSus(answers: number[]) {
  if (answers.length !== 10 || answers.some((n) => !Number.isInteger(n) || n < 1 || n > 5))
    throw new Error('Ten answers between 1 and 5 are required');
  return answers.reduce((sum, n, i) => sum + (i % 2 === 0 ? n - 1 : 5 - n), 0) * 2.5;
}
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

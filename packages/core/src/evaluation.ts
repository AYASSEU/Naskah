export function scoreSus(answers: number[]) {
  if (answers.length !== 10 || answers.some((n) => !Number.isInteger(n) || n < 1 || n > 5))
    throw new Error('Ten answers between 1 and 5 are required');
  return answers.reduce((sum, n, i) => sum + (i % 2 === 0 ? n - 1 : 5 - n), 0) * 2.5;
}

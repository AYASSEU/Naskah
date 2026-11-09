import type { GuardrailReport } from '@naskah/contracts';

function numbers(text: string): Set<string> {
  const withoutIds = text.replace(/\b(?:REQ-[A-Z]-\d+|UC-\d+)\b/g, '');
  return new Set(
    [...withoutIds.matchAll(/\d+(?:[.,]\d+)?(?:%|\b)/g)].map((m) => m[0].replace(',', '.')),
  );
}

/** A model may flag an assumption, but may never clear this deterministic check. */
export function requireGroundedNumbers(
  rewrites: GuardrailReport['rewrites'],
  userInputAndRetrievedContext: string,
): GuardrailReport['rewrites'] {
  const grounded = numbers(userInputAndRetrievedContext);
  return rewrites.map((rewrite) => {
    const prior = numbers(rewrite.original);
    const assumed = [...numbers(rewrite.rewritten)].some((n) => !grounded.has(n) && !prior.has(n));
    return { ...rewrite, needs_confirmation: !!rewrite.needs_confirmation || assumed };
  });
}

/** Never applies an ambiguous span or a change to the requirement identifiers. */
export function applySafeRewrite(text: string, original: string, rewritten: string): string {
  if (
    !original ||
    text.indexOf(original) < 0 ||
    text.indexOf(original) !== text.lastIndexOf(original)
  )
    throw new Error('guardrail_ambiguous_span');
  const ids = (value: string) =>
    [...value.matchAll(/\bREQ-[A-Z]-\d+\b/g)].map((m) => m[0]).join('\n');
  if (ids(original) !== ids(rewritten)) throw new Error('guardrail_requirement_id_changed');
  return text.replace(original, () => rewritten);
}

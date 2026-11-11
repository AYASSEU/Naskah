import { describe, it, expect } from 'vitest';
import { scoreSus, checkStructure } from '@naskah/core';
import { TemplateSchema } from '@naskah/contracts';
import golden from './fixtures/evaluation/golden.json';
describe('shared Python/TypeScript evaluation vectors', () => {
  for (const [index, vector] of golden.sus.entries())
    it('SUS vector ' + index, () => expect(scoreSus(vector.answers)).toBe(vector.score));
  for (const vector of golden.structure)
    it('structure ' + vector.name, () => {
      const run = () => checkStructure(vector.markdown, TemplateSchema.parse(golden.template));
      if (vector.error) expect(run).toThrow(vector.error);
      else {
        expect(run().percentage).toBe(vector.percentage);
        expect(run().missing.map((h) => h.number)).toEqual(vector.missing);
      }
    });
  it('rejects invalid SUS input', () => {
    expect(() => scoreSus([1, 2])).toThrow();
    expect(() => scoreSus(Array(10).fill(1.5))).toThrow();
  });
});

import idMessages from '../apps/web/src/shared/i18n/messages/id.json';
import enMessages from '../apps/web/src/shared/i18n/messages/en.json';
it('keeps the Settings research label separate from the evaluation namespace', () => {
  for (const messages of [idMessages, enMessages]) expect(typeof messages.research).toBe('string');
  expect(Object.keys(idMessages.researchEvaluation).sort()).toEqual(
    Object.keys(enMessages.researchEvaluation).sort(),
  );
});

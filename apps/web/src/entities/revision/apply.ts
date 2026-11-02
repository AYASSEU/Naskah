import type { Section, RevisionProposal } from '@naskah/contracts';
import { parseRequirements } from '../requirement/parsing';
export function applyRevision(sections: Section[], proposal: RevisionProposal): Section[] {
  return sections.map((s) => {
    if (s.id !== proposal.sectionId) return s;
    if (s.status === 'locked') throw new Error('Section is locked');
    if (s.markdown !== proposal.before)
      throw new Error('The section changed after this proposal was created');
    return {
      ...s,
      markdown: proposal.after,
      requirements: parseRequirements(proposal.after),
      status: 'revised',
      source: 'ai_revised',
      updatedAt: new Date().toISOString(),
    };
  });
}

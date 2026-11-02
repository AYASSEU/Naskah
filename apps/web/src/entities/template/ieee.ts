import type { SrsTemplate } from '@naskah/contracts';
export const ieeeTemplate: SrsTemplate = {
  id: 'ieee-830-1998',
  name: 'IEEE 830-1998',
  chapters: [
    {
      number: '1',
      title: 'Introduction',
      prompt: 'n8n/prompts/chapter-1-introduction.md',
      subsections: [
        { number: '1.1', title: 'Purpose (Tujuan)', required: true },
        { number: '1.2', title: 'Scope (Ruang lingkup)', required: true },
        { number: '1.3', title: 'Glossary (Glosarium)', required: true },
        { number: '1.4', title: 'References (Referensi)', required: true },
      ],
    },
    {
      number: '2',
      title: 'Overall Description',
      prompt: 'n8n/prompts/chapter-2-overall-description.md',
      subsections: [
        { number: '2.1', title: 'Product perspective', required: true },
        { number: '2.2', title: 'User classes', required: true },
        { number: '2.3', title: 'Operating environment', required: true },
        { number: '2.4', title: 'Constraints and assumptions', required: true },
      ],
    },
    {
      number: '3',
      title: 'Specific Requirements',
      prompt: 'n8n/prompts/chapter-3-specific-requirements.md',
      subsections: [
        { number: '3.1', title: 'External interfaces', required: true },
        { number: '3.2', title: 'Functional Requirements', required: true },
        { number: '3.3', title: 'Performance requirements', required: true },
        { number: '3.4', title: 'Security requirements', required: true },
        { number: '3.5', title: 'Software attributes', required: true },
      ],
    },
    {
      number: '4',
      title: 'Supporting Artifacts',
      prompt: 'n8n/prompts/chapter-4-supporting-artifacts.md',
      subsections: [
        { number: '4.1', title: 'Use Case Narratives', required: true },
        { number: '4.2', title: 'Requirements Traceability Matrix', required: true },
      ],
    },
  ],
};

import {describe,it,expect} from 'vitest';
import {renderRequirement,requirementAnnotations} from '../packages/core/src/index';
const requirement={id:'REQ-F-01',title:'Audit',description:'Sistem harus menyimpan catatan.',actor:'Penulis',input:'Data',process:'Validasi\nbaris lanjutan',output:'Tersimpan',priority:'High' as const};
describe('structured manuscript annotations',()=>{
  it('keeps appended revision prose and tables visible without duplicating description or metadata',()=>{
    const annotation='Catatan audit B6.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    const markdown=renderRequirement(requirement)+'\n\n'+annotation+'\n\n'+renderRequirement({...requirement,id:'REQ-F-02'});
    expect(requirementAnnotations(markdown,'REQ-F-01')).toBe(annotation);
    expect(requirementAnnotations(markdown,'REQ-F-02')).toBe('');
  });
  it('preserves field-like text in code fences and ignores requirement-like fenced headers',()=>{
    const annotation='```text\nOutput: this is a code sample\n**REQ-F-02 — example**\n```';
    expect(requirementAnnotations(renderRequirement(requirement)+'\n\n'+annotation,'REQ-F-01')).toBe(annotation);
  });
});

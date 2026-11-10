import assert from 'node:assert/strict';
import { DocumentSchema, RevisionProposalSchema } from '../packages/contracts/src/index';
import type { Services, GenerationHandle, GenerationEvent } from '../apps/web/src/services/ports';
import { applyRevision } from '../apps/web/src/entities/revision/apply';
import { parseRequirements } from '../packages/core/src/index';
export async function terminal(handle: GenerationHandle) {
  return new Promise<GenerationEvent>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('port_generation_timeout'));
    }, 120000);
    const accept = (event: GenerationEvent) => {
      if (event.type === 'completed' || event.type === 'failed') {
        clearTimeout(timer);
        unsubscribe();
        resolve(event);
      }
    };
    const unsubscribe = handle.subscribe(accept);
    for (const event of handle.getSnapshot()) accept(event);
  });
}
export async function exercisePorts(services: Services) {
  const p = await services.projects.create({
    title: 'B6 synthetic port conformance',
    domain: 'Healthcare',
    version: '0.1',
    status: 'generating',
    rawText: 'Petugas harus menyimpan data pasien dan catatan audit akses.',
  });
  try {
    assert.equal((await services.projects.get(p.id)).sessionId, p.sessionId);
    const handle = services.generation.start({
      session_id: p.sessionId,
      project_title: p.title,
      domain: p.domain,
      raw_text: p.rawText,
    });
    const event = await terminal(handle);
    assert.equal(
      event.type,
      'completed',
      event.type === 'failed' ? event.error.code : 'generation_not_completed',
    );
    assert.equal((await services.projects.get(p.id)).status, 'in_review');
    const doc = DocumentSchema.parse(await services.documents.getDocument(p.id));
    assert.equal(doc.sections.length, 15);
    const editable = doc.sections.find((s) => s.id === '1.1')!;
    await services.documents.saveSection(p.id, {
      ...editable,
      markdown: editable.markdown + '\n\nCatatan manual conformance.',
      status: 'edited',
      source: 'human',
    });
    const manual = await services.documents.getDocument(p.id);
    assert.ok(
      manual.sections.find((s) => s.id === '1.1')!.markdown.includes('Catatan manual conformance.'),
    );
    assert.deepEqual(
      manual.sections.filter((s) => s.id !== '1.1'),
      doc.sections.filter((s) => s.id !== '1.1'),
    );
    const target = manual.sections.find((s) => s.id === '3.2')!;
    const proposal = RevisionProposalSchema.parse(
      await services.revision.requestRevision({
        session_id: p.sessionId,
        target_section: target.id,
        current_section_text: target.markdown,
        user_instructions: 'Tambahkan audit akses lokal.',
        base_section_version: target.version,
      }),
    );
    assert.equal(proposal.status, 'pending');
    assert.notEqual(proposal.after, proposal.before);
    assert.deepEqual(await services.documents.getDocument(p.id), manual);
    if (services.revision.acceptRevision) await services.revision.acceptRevision(proposal.id);
    else
      await services.documents.saveSections(
        p.id,
        applyRevision(manual.sections, proposal),
        'Revision accepted',
      );
    const accepted = await services.documents.getDocument(p.id);
    assert.equal(accepted.sections.find((s) => s.id === target.id)!.markdown, proposal.after);
    assert.deepEqual(
      accepted.sections.find((s) => s.id === target.id)!.requirements,
      parseRequirements(proposal.after),
    );
    assert.deepEqual(
      accepted.sections.filter((s) => s.id !== target.id),
      manual.sections.filter((s) => s.id !== target.id),
    );
    const other = accepted.sections.find((s) => s.id === '3.4')!;
    const rejected = await services.revision.requestRevision({
      session_id: p.sessionId,
      target_section: other.id,
      current_section_text: other.markdown,
      user_instructions: 'Tambahkan pemeriksaan keamanan lokal.',
      base_section_version: other.version,
    });
    if (services.revision.rejectRevision) await services.revision.rejectRevision(rejected.id);
    assert.deepEqual(await services.documents.getDocument(p.id), accepted);
    const versions = await services.documents.listVersions(p.id);
    assert.ok(versions.length > 0);
    await services.documents.restoreVersion(p.id, versions[0]!.id);
    const restored = await services.documents.getDocument(p.id);
    assert.deepEqual(
      restored.sections.map((s) => s.markdown),
      versions[0]!.sections.map((s) => s.markdown),
    );
    const section = restored.sections[0]!;
    await services.documents.saveSection(p.id, { ...section, status: 'locked' });
    const locked = (await services.documents.getDocument(p.id)).sections[0]!;
    await assert.rejects(() =>
      services.documents.saveSection(p.id, {
        ...locked,
        markdown: locked.markdown + ' forbidden',
        status: 'edited',
      }),
    );
    const result = {
      sections: doc.sections.length,
      events: handle.getSnapshot().length,
      revisionIsolation: true,
      versions: versions.length,
    };
    await services.projects.delete(p.id);
    await assert.rejects(() => services.projects.get(p.id));
    return result;
  } finally {
    await services.projects.delete(p.id).catch(() => {});
  }
}

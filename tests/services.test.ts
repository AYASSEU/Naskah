import { describe, it, expect, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { DocumentSchema, RevisionProposalSchema } from '@naskah/contracts';
vi.mock('@/services/mock/persistence', () => {
  const memory = new Map();
  return {
    persistence: {
      async get(key: string) {
        return memory.get(key);
      },
      async set(key: string, value: unknown) {
        memory.set(key, structuredClone(value));
      },
      async clear() {
        memory.clear();
      },
    },
  };
});
import { createMockServices } from '@/services/mock';
import type { GenerationEvent } from '@/services/ports';
const services = createMockServices();
services.simulation.speed = 'instant';
describe('mock adapters', () => {
  it('reserves distinct requirement IDs for concurrent revisions', async () => {
    const p = (await services.projects.list())[0]!;
    const doc = await services.documents.getDocument(p.id);
    const proposals = await Promise.all(
      ['1.1', '3.4'].map((id) =>
        services.revision.requestRevision({
          session_id: p.sessionId,
          target_section: id,
          current_section_text: doc.sections.find((s) => s.id === id)!.markdown,
          user_instructions: 'Wajibkan 2FA dan AES-256',
        }),
      ),
    );
    const ids = proposals.map((proposal) => [...proposal.after.matchAll(/REQ-F-\d+/g)].at(-1)![0]);
    expect(new Set(ids).size).toBe(2);
  });
  it('provides validated document and revision output', async () => {
    const projects = await services.projects.list();
    const doc = await services.documents.getDocument(projects[0]!.id);
    expect(DocumentSchema.safeParse(doc).success).toBe(true);
    const s = doc.sections.find((s) => s.id === '3.4')!;
    const proposal = await services.revision.requestRevision({
      session_id: projects[0]!.sessionId,
      target_section: s.id + ' ' + s.title,
      current_section_text: s.markdown,
      user_instructions: '2FA and AES-256',
    });
    expect(RevisionProposalSchema.safeParse(proposal).success).toBe(true);
    expect(proposal.after).toContain('TOTP');
    expect(
      (await services.documents.getDocument(doc.projectId)).sections.find(
        (s) => s.id === proposal.sectionId,
      )!.markdown,
    ).toBe(proposal.before);
  });
  it('streams ordered chapters, saves progress, records a generation log', async () => {
    const project = await services.projects.create({
      title: 'Sistem antrian klinik',
      domain: 'Healthcare',
      version: '0.1',
      status: 'generating',
      rawText: 'Petugas mendaftarkan pasien dan mencatat waktu kunjungan.',
    });
    const handle = services.generation.start({
      session_id: project.sessionId,
      project_title: project.title,
      domain: project.domain,
      raw_text: project.rawText,
    });
    const events: GenerationEvent[] = [];
    await new Promise<void>((resolve, reject) =>
      handle.subscribe((event) => {
        events.push(event);
        if (event.type === 'completed') resolve();
        if (event.type === 'failed') reject(event.error);
      }),
    );
    expect(events.filter((e) => e.type === 'section_started').map((e) => e.sectionId)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect((await services.projects.get(project.id)).status).toBe('in_review');
    expect(
      (await services.evaluation.listGenerationLogs()).some(
        (l) => l.session_id === project.sessionId && l.status === 'success',
      ),
    ).toBe(true);
  });
  it('preserves completed chapters on failure and resumes at chapter 3', async () => {
    const p = await services.projects.create({
      title: 'Uji pemulihan',
      domain: 'Education',
      version: '0.1',
      status: 'generating',
      rawText: 'Peminjaman perpustakaan kampus.',
    });
    services.simulation.failure = 'chapter3';
    const input = {
      session_id: p.sessionId,
      project_title: p.title,
      domain: p.domain,
      raw_text: p.rawText,
    };
    await new Promise<void>((resolve) =>
      services.generation.start(input).subscribe((e) => {
        if (e.type === 'failed') resolve();
      }),
    );
    const before = await services.documents.getDocument(p.id);
    expect(before.sections.find((s) => s.id === '1.1')!.markdown).not.toBe('');
    expect(before.sections.find((s) => s.id === '3.1')!.status).toBe('pending');
    services.simulation.failure = 'none';
    const starts: string[] = [];
    await new Promise<void>((resolve, reject) =>
      services.generation.start(input).subscribe((e) => {
        if (e.type === 'section_started') starts.push(e.sectionId);
        if (e.type === 'completed') resolve();
        if (e.type === 'failed') reject(e.error);
      }),
    );
    expect(starts).toEqual(['3', '4']);
    expect((await services.documents.getDocument(p.id)).sections[0]!.markdown).toBe(
      before.sections[0]!.markdown,
    );
  });
  it('compiles an actual DOCX zip with cover, contents field, tables and A4 margins', async () => {
    const p = (await services.projects.list()).find((p) => p.domain === 'Healthcare')!;
    const artifact = await services.compiler.compile(p.id, 'docx');
    const zip = unzipSync(new Uint8Array(await (await fetch(artifact.url)).arrayBuffer()));
    const xml = strFromU8(zip['word/document.xml']!);
    expect(xml).toContain('Software Requirements Specification');
    expect(xml).toContain('TOC');
    expect(xml).toContain('w:tbl');
    expect(xml).toContain('w:left="2268"');
    expect(artifact.size).toBeGreaterThan(10000);
    URL.revokeObjectURL(artifact.url);
  });
});

describe('storage recovery', () => {
  it('can clear incompatible persisted data without first reading the broken database', async () => {
    const { persistence } = await import('@/services/mock/persistence');
    await persistence.set('database', { version: 0 });
    vi.resetModules();
    const recovered = (await import('@/services/mock')).createMockServices();
    await expect(recovered.projects.list()).rejects.toMatchObject({ code: 'schema_mismatch' });
    await recovered.reset();
    expect(await recovered.projects.list()).toEqual([]);
    await recovered.loadExamples();
    expect(await recovered.projects.list()).toHaveLength(3);
  });
});

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { unzipSync } from 'fflate';
import { renderDocumentSections } from '@naskah/core';
import { CompileResultSchema, type CompileInputSchema } from '@naskah/contracts';
import { z } from 'zod';
import { env } from '../config/env.server';
import { db, transaction } from '../db/client';
import { projectTx, documentTx, templateTx } from '../application/data';
import { AppError } from '../http/errors';
import { documentService, HealthSchema } from './service';
const mime = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};
type ExportRow = {
  id: string;
  object_path: string;
  filename: string;
  size: number;
  format: 'docx' | 'pdf';
};
const pending = new Map<string, Promise<void>>();
export async function compileDocument(owner: string, input: z.infer<typeof CompileInputSchema>) {
  if (env().COMPILER_MODE === 'client') return CompileResultSchema.parse({ mode: 'client' });
  const snapshot = await transaction(async (tx) => {
    const p = await projectTx(tx, owner, input.documentId, true);
    if (p.status !== 'finalized') throw new AppError('document_not_finalized', 409);
    const document = await documentTx(tx, owner, p.id),
      template = await templateTx(tx, document.templateId);
    return {
      markdown: renderDocumentSections(document.sections, template),
      metadata: {
        title: 'Software Requirements Specification',
        project: p.title,
        version: p.version,
        author: input.author ?? '',
        institution: input.institution ?? '',
        date: new Date(p.created_at).toISOString().slice(0, 10),
      },
    };
  });
  const health = HealthSchema.parse(await (await documentService('/health')).json());
  const hash = createHash('sha256')
    .update(JSON.stringify({ snapshot, compiler: health }))
    .digest('hex');
  const base = `${owner}/${input.documentId}/${hash}`;
  const cached = () =>
    transaction(
      (tx) =>
        tx<
          ExportRow[]
        >`select id,object_path,filename,size,format from public.exports where owner_id=${owner} and project_id=${input.documentId} and object_path in (${base + '.docx'},${base + '.pdf'})`,
    );
  if ((await cached()).length !== 2) {
    let operation = pending.get(base);
    if (!operation) {
      operation = (async () => {
        if ((await cached()).length === 2) return;
        const response = await documentService('/compile', JSON.stringify(snapshot));
        const archive = await response.arrayBuffer();
        if (archive.byteLength > 50 * 1024 * 1024) throw new AppError('too_large', 413);
        // Filter by exact name and bound the declared inflated size before allocation.
        const files = unzipSync(new Uint8Array(archive), {
          filter: (file) =>
            ['document.docx', 'document.pdf'].includes(file.name) &&
            file.originalSize <= 25 * 1024 * 1024,
        });
        const rows: ExportRow[] = [];
        try {
          for (const format of ['docx', 'pdf'] as const) {
            const bytes = files[`document.${format}`];
            if (
              !bytes?.length ||
              (format === 'pdf'
                ? Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-'
                : bytes[0] !== 80 || bytes[1] !== 75)
            )
              throw new AppError('compiler_failed', 502);
            const path = base + '.' + format;
            const uploaded = await db()
              .storage.from('exports')
              .upload(path, bytes, { contentType: mime[format], upsert: true });
            if (uploaded.error) throw new AppError('export_storage_failed', 503, true);
            const stem =
              snapshot.metadata.project
                .normalize('NFKC')
                .replace(/[^\p{L}\p{N}_ -]/gu, '')
                .slice(0, 100)
                .trim() || 'Naskah';
            rows.push({
              id: randomUUID(),
              object_path: path,
              filename: `SRS ${stem}.${format}`,
              size: bytes.length,
              format,
            });
          }
          await transaction(async (tx) => {
            await projectTx(tx, owner, input.documentId, true);
            for (const row of rows)
              await tx`insert into public.exports(id,owner_id,project_id,object_path,format,filename,size) values(${row.id},${owner},${input.documentId},${row.object_path},${row.format},${row.filename},${row.size}) on conflict(object_path) do nothing`;
          });
        } catch (error) {
          // Only clean objects created for this snapshot when no metadata was committed.
          if (!(await cached()).length)
            await db()
              .storage.from('exports')
              .remove(rows.map((row) => row.object_path));
          throw error;
        }
      })();
      pending.set(base, operation);
    }
    try {
      await operation;
    } finally {
      if (pending.get(base) === operation) pending.delete(base);
    }
  }
  const row = (await cached()).find((row) => row.format === input.format);
  if (!row) throw new AppError('compiler_failed', 502, true);
  return CompileResultSchema.parse({
    mode: 'server',
    url: `/api/exports/${row.id}`,
    filename: row.filename,
    size: Number(row.size),
    format: row.format,
  });
}
export async function downloadExport(owner: string, id: string) {
  z.uuid().parse(id);
  const [row] = await transaction(
    (tx) =>
      tx<
        ExportRow[]
      >`select id,object_path,filename,size,format from public.exports where id=${id} and owner_id=${owner}`,
  );
  if (!row) throw new AppError('not_found', 404);
  const { data, error } = await db().storage.from('exports').createSignedUrl(row.object_path, 60);
  if (error || !data) throw new AppError('export_storage_failed', 503, true);
  const file = await fetch(data.signedUrl, {
    signal: AbortSignal.timeout(30000),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!file.ok) throw new AppError('export_storage_failed', 503, true);
  return new Response(file.body, {
    headers: {
      'Content-Type': mime[row.format],
      'Content-Length': String(row.size),
      'Content-Disposition': `attachment; filename="Naskah.${row.format}"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

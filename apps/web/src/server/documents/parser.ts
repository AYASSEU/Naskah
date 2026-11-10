import 'server-only';
import { z } from 'zod';
import { ParsedDocumentSchema } from '@naskah/contracts';
import { cleanPages } from '@/entities/document/cleaning';
import { AppError } from '../http/errors';
import { documentService } from './service';
const MAX_FILE = 10 * 1024 * 1024;
export async function parseUpload(request: Request) {
  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data;') || !request.body)
    throw new AppError('invalid_input', 415);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE + 65536)
    throw new AppError('too_large', 413);
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE + 65536) {
        await reader.cancel();
        throw new AppError('too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': type },
    }).formData();
  } catch {
    throw new AppError('invalid_file');
  }
  const file = form.get('file');
  if (
    !(file instanceof File) ||
    [...form.keys()].length !== 1 ||
    !file.name ||
    file.name.length > 255 ||
    !/\.(pdf|txt)$/i.test(file.name)
  )
    throw new AppError('invalid_file');
  if (file.size === 0) throw new AppError('invalid_file');
  if (file.size > MAX_FILE) throw new AppError('too_large', 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  let pages: string[];
  if (/\.txt$/i.test(file.name)) {
    try {
      pages = [new TextDecoder('utf-8', { fatal: true }).decode(bytes)];
    } catch {
      throw new AppError('invalid_encoding');
    }
  } else {
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new AppError('invalid_file');
    pages = z
      .object({ pages: z.array(z.string()).min(1).max(200) })
      .parse(await (await documentService('/parse', bytes, 'application/pdf')).json()).pages;
  }
  const cleaned = cleanPages(pages);
  if (!cleaned.text.trim()) throw new AppError('no_text_layer', 422);
  if (Buffer.byteLength(cleaned.text) > 2 * 1024 * 1024) throw new AppError('too_large', 413);
  return ParsedDocumentSchema.parse({ name: file.name, size: file.size, ...cleaned });
}

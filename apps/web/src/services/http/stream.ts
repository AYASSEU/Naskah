import { WorkflowEventSchema } from '@naskah/contracts';
import { PortError } from '../ports';
import { ensureSession, throwResponse } from './client';
export type WireEvent = ReturnType<typeof WorkflowEventSchema.parse>;
export class SseDecoder {
  private pending = '';
  feed(text: string) {
    this.pending = (this.pending + text).replaceAll('\r\n', '\n');
    if (this.pending.length > 8 * 1024 * 1024)
      throw new PortError('too_large', false, 'backendErrors.too_large');
    const blocks = this.pending.split('\n\n');
    this.pending = blocks.pop()!;
    return blocks.flatMap((block) => {
      const lines = block.split('\n'),
        id = lines
          .find((line) => line.startsWith('id:'))
          ?.slice(3)
          .trim();
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!id || !data) return [];
      if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)))
        throw new PortError(
          'provider_invalid_response',
          true,
          'backendErrors.provider_invalid_response',
        );
      return [{ seq: Number(id), event: WorkflowEventSchema.parse(JSON.parse(data)) }];
    });
  }
}
const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const stop = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      resolve();
    };
    const timer = setTimeout(stop, ms);
    signal.addEventListener('abort', stop, { once: true });
  });
class EventFailure extends Error {
  constructor(readonly error: unknown) {
    super('event_failed');
  }
}
export async function watchEvents(
  path: string,
  after: number,
  onEvent: (event: WireEvent) => boolean,
  signal: AbortSignal,
) {
  let cursor = after,
    attempt = 0;
  const deadline = Date.now() + 20 * 60 * 1000;
  while (!signal.aborted) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      await ensureSession();
      const response = await fetch(path, {
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'X-Naskah-Client': 'web', 'Last-Event-ID': String(cursor) },
        signal,
      });
      if (response.status === 401) {
        await ensureSession(true);
        throw new Error('session_refreshed');
      }
      if (!response.ok) await throwResponse(response);
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream'))
        throw new PortError(
          'provider_invalid_response',
          true,
          'backendErrors.provider_invalid_response',
        );
      reader = response.body.getReader();
      const decoder = new TextDecoder(),
        sse = new SseDecoder();
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const item of sse.feed(decoder.decode(value, { stream: true }))) {
          if (item.seq <= cursor) continue;
          cursor = item.seq;
          attempt = 0;
          try {
            if (onEvent(item.event)) return;
          } catch (error) {
            throw new EventFailure(error);
          }
        }
      }
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof EventFailure) throw error.error;
      if (error instanceof PortError && !error.retryable) throw error;
      if (
        error instanceof PortError &&
        ['not_found', 'unauthorized', 'local_access_only'].includes(error.code)
      )
        throw error;
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
    if (Date.now() > deadline) throw new PortError('timeout', true, 'backendErrors.timeout');
    await delay(Math.min(5000, 250 * 2 ** Math.min(attempt++, 5)), signal);
  }
}
export const eventError = (event: Extract<WireEvent, { type: 'failed' }>) =>
  new PortError(
    event.error.code,
    event.error.retryable,
    event.error.userMessageKey ?? event.error.userMessage ?? `backendErrors.${event.error.code}`,
  );

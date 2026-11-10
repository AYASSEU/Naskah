import {describe,it,expect,vi,afterEach} from 'vitest';
vi.mock('@/services/http/client',()=>({ensureSession:vi.fn(async()=>{}),throwResponse:vi.fn(async()=>{throw new Error('http_error');})}));
import {SseDecoder,watchEvents,eventError} from '@/services/http/stream';
import {PortError} from '@/services/ports';
const encoder=new TextEncoder();
const response=(body:string)=>new Response(new ReadableStream({start(controller){controller.enqueue(encoder.encode(body));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
afterEach(()=>vi.unstubAllGlobals());
describe('HTTP SSE transport',()=>{
  it('decodes fragmented CRLF events and ignores heartbeat comments',()=>{
    const decoder=new SseDecoder();
    expect(decoder.feed(': heartbeat\r\n\r\n'+'id: 12\r')).toEqual([]);
    expect(decoder.feed('\ndata: {"type":"section_drafted","sectionId":"1.1","markdown":"Teks lokal"}\r\n\r')).toEqual([]);
    expect(decoder.feed('\n')).toEqual([{seq:12,event:{type:'section_drafted',sectionId:'1.1',markdown:'Teks lokal'}}]);
  });
  it('reconnects after a truncated stream using the last ID and ignores replayed rows',async()=>{
    const transport=vi.fn().mockResolvedValueOnce(response('id: 1\ndata: {"type":"stage","stage":"drafting","at":"now"}\n\n')).mockResolvedValueOnce(response('id: 1\ndata: {"type":"stage","stage":"drafting","at":"now"}\n\nid: 2\ndata: {"type":"cancelled"}\n\n'));
    vi.stubGlobal('fetch',transport);const seen:string[]=[];
    await watchEvents('/api/test/events',0,event=>{seen.push(event.type);return event.type==='cancelled';},new AbortController().signal);
    expect(seen).toEqual(['stage','cancelled']);
    expect(transport.mock.calls[1]![1].headers['Last-Event-ID']).toBe('1');
  });
  it('propagates a retryable workflow failure instead of reconnecting forever',async()=>{
    const transport=vi.fn().mockResolvedValue(response('id: 3\ndata: {"type":"failed","stage":"draft","error":{"code":"llm_invalid_output","retryable":true}}\n\n'));
    vi.stubGlobal('fetch',transport);
    await expect(watchEvents('/api/test/events',0,event=>{if(event.type==='failed')throw eventError(event);return false;},new AbortController().signal)).rejects.toMatchObject({code:'llm_invalid_output',retryable:true});
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid cursors and bounded-memory overflow',()=>{
    expect(()=>new SseDecoder().feed('id: x\ndata: {"type":"cancelled"}\n\n')).toThrow(PortError);
    expect(()=>new SseDecoder().feed('x'.repeat(8*1024*1024+1))).toThrow('backendErrors.too_large');
  });
});

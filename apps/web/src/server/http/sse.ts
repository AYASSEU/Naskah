import 'server-only';
export interface StreamEvent {seq:number;type:string;payload:unknown}
export function eventStream(request:Request,after:number,read:(after:number)=>Promise<StreamEvent[]>,terminal=(event:StreamEvent)=>['completed','failed','cancelled'].includes(event.type)) {
  const encoder=new TextEncoder();let stopped=false,wake:(()=>void)|undefined;
  const stop=()=>{stopped=true;wake?.();};
  request.signal.addEventListener('abort',stop,{once:true});
  const stream=new ReadableStream<Uint8Array>({
    async start(controller){
      let cursor=after,lastHeartbeat=Date.now();
      try{
        while(!stopped){
          const events=await read(cursor);
          for(const event of events){
            if(stopped)break;
            if(event.seq<=cursor)continue;
            controller.enqueue(encoder.encode(`id: ${event.seq}\ndata: ${JSON.stringify(event.payload)}\n\n`));cursor=event.seq;
            if(terminal(event)){stopped=true;break;}
          }
          if(stopped)break;
          if(Date.now()-lastHeartbeat>=15000){controller.enqueue(encoder.encode(': heartbeat\n\n'));lastHeartbeat=Date.now();}
          await new Promise<void>(resolve=>{const timer=setTimeout(()=>{wake=undefined;resolve();},500);wake=()=>{clearTimeout(timer);resolve();};});
        }
        controller.close();
      }catch{if(!stopped)controller.error(new Error('stream_disconnected'));}
      finally{stopped=true;request.signal.removeEventListener('abort',stop);}
    },cancel(){stop();request.signal.removeEventListener('abort',stop);},
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
}

import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
const port=Number(process.env.MOCK_LLM_PORT||4010);
let scenario=process.env.MOCK_FAILURE||'none';
const requests=[];
export function embedding(text,dimensions=1536){
  const vector=Array(dimensions).fill(0);
  for(const word of String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]){const hash=createHash('sha256').update(word).digest();vector[hash.readUInt32BE(0)%dimensions]+=1;}
  const norm=Math.hypot(...vector)||1;return vector.map(v=>v/norm);
}
function chapter(prompt){
  const match=prompt.match(/<task_json>([\s\S]*?)<\/task_json>/);let task={};try{task=JSON.parse(match?.[1]||'{}');}catch{}
  const section=task.section;
  if(task.kind==='refine')return {queries:[task.instruction||'requirements'],intent:'targeted revision'};
  if(task.kind==='revision')return {revised_text:`${task.current_text}\n\n${task.instruction}`,requirements:[],guardrail:{dimensions:[],rewrites:[]}};
  if(task.kind==='guardrail')return {dimensions:['unambiguous','complete','correct','verifiable'].map(name=>({name,passed:true,reason:'Deterministic mock evaluation; not a research rating.'})),rewrites:[],corrected:task.chapter};
  if(task.kind==='summary')return {summary:String(task.text||'').slice(0,8000)};
  const number=String(task.number||1),subsections=task.subsections||[{number:`${number}.1`,title:'Purpose'}];
  return {number,title:task.title||'Introduction',sections:subsections.map(s=>({number:s.number,title:s.title,body:`${task.language==='en'?'The system shall':'Sistem harus'} mendukung ${task.project_title||'proyek'} sesuai kebutuhan yang diberikan. Synthetic development output.`,requirements:s.number==='3.2'?[{id:'REQ-F-01',title:'Pencatatan kebutuhan',description:'Sistem harus menyimpan kebutuhan yang divalidasi pengguna.',actor:'Penulis',input:'Kebutuhan tervalidasi',process:'Validasi dan penyimpanan',output:'Konfirmasi tersimpan',priority:'High'}]:[],...section}))};
}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const reply=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(data));};
  if(url.pathname==='/health')return reply(200,{ok:true,mock:true});
  let text='';for await(const chunk of req){text+=chunk;if(text.length>4*1024*1024)return reply(413,{error:{code:'too_large'}});}
  let input={};try{input=JSON.parse(text||'{}');}catch{return reply(400,{error:{code:'invalid_json'}});}
  if(url.pathname.startsWith('/__test/')){
    if(!process.env.MOCK_CONTROL_TOKEN||req.headers.authorization!==`Bearer ${process.env.MOCK_CONTROL_TOKEN}`)return reply(401,{error:{code:'unauthorized'}});
    if(url.pathname==='/__test/scenario'){scenario=input.failure||'none';return reply(200,{ok:true});}
    if(url.pathname==='/__test/requests')return reply(200,{requests});
    return reply(404,{error:{code:'not_found'}});
  }
  const key=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!key.startsWith('naskah-test-'))return reply(401,{error:{code:'invalid_api_key'}});
  requests.push({path:url.pathname,keyHash:createHash('sha256').update(key).digest('hex'),at:new Date().toISOString()});if(requests.length>1000)requests.shift();
  const failure=String(req.headers['x-mock-failure']||scenario);
  if(failure==='401')return reply(401,{error:{code:'invalid_api_key'}});
  if(failure==='429')return reply(429,{error:{code:'rate_limited'}},{'Retry-After':'1'});
  if(failure==='500')return reply(500,{error:{code:'server_error'}});
  if(failure==='timeout'||failure==='slow')await new Promise(r=>setTimeout(r,failure==='timeout'?65000:1500));
  if(url.pathname.endsWith('/models'))return reply(200,{object:'list',data:['deepseek-flash','deepseek-v4-flash','text-embedding-3-small','naskah-test-model'].map(id=>({id,object:'model'}))});
  if(url.pathname.endsWith('/embeddings')){const inputs=Array.isArray(input.input)?input.input:[input.input];return reply(200,{model:input.model,data:inputs.map((v,index)=>({index,embedding:embedding(v,failure==='dimension'?8:input.dimensions||1536)})),usage:{prompt_tokens:inputs.join(' ').split(/\s+/).length,total_tokens:inputs.join(' ').split(/\s+/).length}});}
  if(url.pathname.endsWith('/chat/completions')){
    const prompt=(input.messages||[]).map(m=>m.content).join('\n');
    let content=input.max_tokens===1?'OK':JSON.stringify(chapter(prompt));
    if(failure==='malformed')content='{broken';if(failure==='schema-invalid')content='{"invalid":true}';if(failure==='empty')content='   ';
    return reply(200,{id:`mock-${createHash('sha256').update(prompt).digest('hex').slice(0,16)}`,model:input.model,choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:Math.ceil(prompt.length/4),completion_tokens:Math.ceil(content.length/4),total_tokens:Math.ceil((prompt.length+content.length)/4)}});
  }
  reply(404,{error:{code:'not_found'}});
});
server.listen(port,'0.0.0.0',()=>console.log(`Mock provider listening on ${port}; request bodies and credentials are never logged.`));

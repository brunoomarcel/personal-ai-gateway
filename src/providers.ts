import type { InferenceProvider, InferenceRequest, InferenceChunk } from './types.js';
import { ChatGPTOAuthSession } from './oauth.js';
const wait = (ms:number) => new Promise(r=>setTimeout(r,ms));
export class MockOAuthProvider implements InferenceProvider {
  readonly name = 'mock-oauth';
  async status() { return { authenticated: true, account: 'mock-account@local.test', models: ['mock-gpt-4o-mini','mock-reasoner'] }; }
  async models() { return ['mock-gpt-4o-mini','mock-reasoner']; }
  async complete(req: InferenceRequest) { const last=req.messages.at(-1)?.content ?? ''; const text=`[mock] Recebi: ${last}`; return {text, model:req.model, usage:{input_tokens:last.length, output_tokens:text.length}}; }
  async *stream(req: InferenceRequest): AsyncGenerator<InferenceChunk> { const result=await this.complete(req); for (const word of result.text.split(' ')) { await wait(15); yield {delta:word+' '}; } yield {delta:'',done:true}; }
}
export class AuthorizedOAuthProvider implements InferenceProvider {
  readonly name = 'authorized-oauth';
  constructor(private readonly session = new ChatGPTOAuthSession()) {}
  async status() { return {...this.session.status(),models:await this.models().catch(()=>[])}; }
  async models() { const token=await this.session.accessToken(); const r=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${token}`}}); if(!r.ok)throw new Error(`Model discovery failed (${r.status})`); const body:any=await r.json(); return (body.models??body.data??[]).map((m:any)=>m.slug??m.id).filter(Boolean); }
  async complete(req:InferenceRequest) { let text=''; for await(const chunk of this.stream(req)) text+=chunk.delta; return {text,model:req.model,usage:{input_tokens:0,output_tokens:0}}; }
  async *stream(req:InferenceRequest): AsyncGenerator<InferenceChunk> { const token=await this.session.accessToken(); const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({model:req.model,input:req.messages,instructions:req.instructions,store:false,stream:true})}); if(!r.ok)throw new Error(`Responses request failed (${r.status})`); if(!r.body)throw new Error('Responses stream unavailable'); const reader=r.body.getReader(), decoder=new TextDecoder(); let buffer=''; let completed=false; while(true){const {done,value}=await reader.read(); if(done)break; buffer+=decoder.decode(value,{stream:true}); const events=buffer.split('\n\n'); buffer=events.pop()??''; for(const event of events){const line=event.split('\n').find(x=>x.startsWith('data: ')); if(!line)continue; const data=line.slice(6); if(data==='[DONE]')continue; let item:any; try{item=JSON.parse(data)}catch{continue;} if(item.type==='response.output_text.delta')yield {delta:item.delta??''}; if(item.type==='response.completed')completed=true; if(item.type==='response.failed')throw new Error(item.response?.error?.message??'Responses request failed'); }} if(!completed)throw new Error('Responses stream ended before response.completed'); yield {delta:'',done:true}; }
}

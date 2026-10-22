import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { openDb, findKey, record } from './db.js';
import { bearer, makeApiKey } from './security.js';
import { MockOAuthProvider, AuthorizedOAuthProvider } from './providers.js';
import { ChatGPTOAuthSession } from './oauth.js';
import type { InferenceProvider, InferenceRequest } from './types.js';

const message = z.object({role:z.enum(['system','user','assistant','developer']),content:z.string().min(1).max(100_000)});
const input = z.object({model:z.string().min(1).max(100),messages:z.array(message).min(1).max(100),stream:z.boolean().optional(),instructions:z.string().max(20_000).optional()});
const responseInput = z.object({model:z.string().min(1),input:z.union([z.string(),z.array(message)]),stream:z.boolean().optional(),instructions:z.string().optional()});
export function buildApp(provider: InferenceProvider = new MockOAuthProvider(), db = openDb(':memory:'), oauthSession?: ChatGPTOAuthSession) {
  const app=Fastify({logger:true,bodyLimit:256*1024}); app.register(cors,{origin:true}); app.register(rateLimit,{max:60,timeWindow:'1 minute'});
  const admin = async (req:any, reply:any) => { const token=bearer(req.headers.authorization); if(!token || token !== (process.env.ADMIN_TOKEN ?? 'change-me-in-development')) return reply.code(401).send({error:{message:'Admin authentication required',type:'authentication_error'}}); };
  const auth = async (req:any, reply:any) => { const token=bearer(req.headers.authorization); const key=token && findKey(db,token); if(!key) return reply.code(401).send({error:{message:'Valid pai_ API key required',type:'authentication_error'}}); if(key.expires_at && Date.parse(key.expires_at)<Date.now()) return reply.code(401).send({error:{message:'API key expired',type:'authentication_error'}}); if(key.request_limit !== null && key.request_count >= key.request_limit) return reply.code(429).send({error:{message:'API key request limit exceeded',type:'rate_limit_error'}}); req.gatewayKey=key; };
  app.get('/health',async()=>({status:'ok',provider:provider.name,uptime_seconds:Math.round(process.uptime())}));
  if (oauthSession) {
    app.get('/auth/chatgpt/start', async (_req, reply) => reply.redirect(oauthSession.start()));
    app.get('/auth/chatgpt/callback', async (req:any, reply) => { try { await oauthSession.callback(req.query); return reply.type('text/html; charset=utf-8').send('<h1>ChatGPT conectado</h1><p>Você pode fechar esta janela e voltar ao dashboard.</p>'); } catch (e:any) { return reply.code(400).type('text/html; charset=utf-8').send(`<h1>Falha no OAuth</h1><p>${String(e.message).replace(/[<>]/g,'')}</p>`); } });
    app.get('/auth/chatgpt/status', async () => oauthSession.status());
    app.post('/auth/chatgpt/disconnect', async () => { oauthSession.disconnect(); return {ok:true}; });
  }
  app.get('/v1/models', {preHandler:auth}, async()=>({object:'list',data:(await provider.models()).map(id=>({id,object:'model',owned_by:provider.name}))}));
  app.get('/v1/usage',{preHandler:admin},async()=>db.prepare('SELECT COUNT(*) as requests, SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors, COALESCE(AVG(duration_ms),0) as average_latency_ms FROM requests').get());
  app.post('/admin/keys',{preHandler:admin},async(req:any)=>{const body=z.object({name:z.string().min(1).max(80),expires_at:z.string().datetime().optional(),request_limit:z.number().int().positive().optional(),permissions:z.array(z.string()).default(['chat:write'])}).parse(req.body); const key=makeApiKey(), id=randomUUID(); db.prepare('INSERT INTO api_keys(id,name,secret_hash,created_at,expires_at,request_limit,permissions) VALUES(?,?,?,?,?,?,?)').run(id,body.name,key.hash,new Date().toISOString(),body.expires_at??null,body.request_limit??null,JSON.stringify(body.permissions)); return {id,name:body.name,key:key.raw,warning:'Copy this key now. It will never be shown again.'};});
  app.get('/admin/keys',{preHandler:admin},async()=>({data:db.prepare('SELECT id,name,created_at,expires_at,revoked_at,request_limit,request_count,permissions FROM api_keys ORDER BY created_at DESC').all().map((x:any)=>({...x,permissions:JSON.parse(x.permissions)}))}));
  app.delete('/admin/keys/:id',{preHandler:admin},async(req:any,reply)=>{const r=db.prepare('UPDATE api_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(new Date().toISOString(),req.params.id); if(!r.changes)return reply.code(404).send({error:{message:'Key not found'}}); return {ok:true};});
  async function run(req:any,reply:any, data:InferenceRequest) { const start=Date.now(), key=req.gatewayKey; try { const result=await provider.complete(data); record(db,key.id,data.model,200,Date.now()-start); return {id:`chatcmpl_${randomUUID()}`,object:'chat.completion',created:Math.floor(Date.now()/1000),model:result.model,choices:[{index:0,message:{role:'assistant',content:result.text},finish_reason:'stop'}],usage:result.usage}; } catch(e:any) { record(db,key?.id,data.model,502,Date.now()-start,e.message); return reply.code(502).send({error:{message:'Inference provider unavailable',type:'provider_error'}}); } }
  app.post('/v1/chat/completions',{preHandler:auth},async(req:any,reply)=>{const parsed=input.safeParse(req.body); if(!parsed.success)return reply.code(400).send({error:{message:'Invalid chat payload',type:'invalid_request_error',details:parsed.error.flatten()}}); const data=parsed.data as InferenceRequest; if(data.stream){reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}); const start=Date.now(); try { for await(const chunk of provider.stream(data)) reply.raw.write(`data: ${JSON.stringify({id:`chatcmpl_${randomUUID()}`,object:'chat.completion.chunk',model:data.model,choices:[{index:0,delta:chunk.done?{}:{content:chunk.delta},finish_reason:chunk.done?'stop':null}]})}\n\n`); record(db,req.gatewayKey.id,data.model,200,Date.now()-start); reply.raw.write('data: [DONE]\n\n'); } catch { record(db,req.gatewayKey.id,data.model,502,Date.now()-start,'stream error'); } finally { reply.raw.end(); } return; } return run(req,reply,data);});
  app.post('/v1/responses',{preHandler:auth},async(req:any,reply)=>{const parsed=responseInput.safeParse(req.body); if(!parsed.success)return reply.code(400).send({error:{message:'Invalid responses payload',type:'invalid_request_error'}}); const messages=typeof parsed.data.input==='string'?[{role:'user' as const,content:parsed.data.input}]:parsed.data.input; const result=await run(req,reply,{model:parsed.data.model,messages,instructions:parsed.data.instructions,stream:false}); if(!result || result.error)return result; return {id:`resp_${randomUUID()}`,object:'response',model:result.model,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:result.choices[0].message.content}]}],usage:result.usage};});
  return app;
}
if (process.env.NODE_ENV !== 'test') { const session=new ChatGPTOAuthSession(); const provider=process.env.PROVIDER==='authorized'?new AuthorizedOAuthProvider(session):new MockOAuthProvider(); const app=buildApp(provider,undefined,session); app.listen({port:Number(process.env.PORT??3333),host:process.env.HOST??'127.0.0.1'}).catch(e=>{app.log.error(e);process.exit(1);}); }

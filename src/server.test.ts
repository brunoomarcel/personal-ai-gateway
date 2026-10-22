import { describe, expect, it } from 'vitest';
import { buildApp } from './server.js';

describe('gateway proof of concept', () => {
  it('creates a one-time key and serves a completion', async () => {
    process.env.ADMIN_TOKEN = 'test-admin';
    const app = buildApp();
    const created = await app.inject({ method:'POST', url:'/admin/keys', headers:{authorization:'Bearer test-admin'}, payload:{name:'test-client'} });
    expect(created.statusCode).toBe(200);
    const key = created.json().key;
    expect(key).toMatch(/^pai_/);
    const completion = await app.inject({ method:'POST', url:'/v1/chat/completions', headers:{authorization:`Bearer ${key}`}, payload:{model:'mock-gpt-4o-mini',messages:[{role:'user',content:'hello'}]} });
    expect(completion.statusCode).toBe(200);
    expect(completion.json().choices[0].message.content).toContain('[mock]');
    expect((await app.inject({method:'GET',url:'/admin/keys',headers:{authorization:'Bearer test-admin'}})).json().data[0].secret_hash).toBeUndefined();
  });

  it('emits SSE chunks and rejects a revoked key', async () => {
    const app = buildApp();
    const created = await app.inject({ method:'POST', url:'/admin/keys', headers:{authorization:'Bearer test-admin'}, payload:{name:'stream-client'} });
    const {id,key} = created.json();
    const streamed = await app.inject({ method:'POST', url:'/v1/chat/completions', headers:{authorization:`Bearer ${key}`}, payload:{model:'mock-gpt-4o-mini',stream:true,messages:[{role:'user',content:'stream'}]} });
    expect(streamed.statusCode).toBe(200); expect(streamed.body).toContain('data: [DONE]');
    expect((await app.inject({method:'DELETE',url:`/admin/keys/${id}`,headers:{authorization:'Bearer test-admin'}})).statusCode).toBe(200);
    expect((await app.inject({method:'GET',url:'/v1/models',headers:{authorization:`Bearer ${key}`}})).statusCode).toBe(401);
  });
});

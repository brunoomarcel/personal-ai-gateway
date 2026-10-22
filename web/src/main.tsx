import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = 'http://127.0.0.1:3333';

function App() {
  const [prompt, setPrompt] = useState('Explique esta arquitetura em uma frase.');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [keyName, setKeyName] = useState('dashboard-client');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState('checking');
  const [account, setAccount] = useState('');

  useEffect(() => { Promise.all([fetch(`${API}/health`).then(r => r.json()), fetch(`${API}/auth/chatgpt/status`).then(r => r.json())]).then(([h, s]) => { setProvider(h.provider ?? 'unknown'); setAccount(s.account ?? 'OAuth session'); }).catch(() => setProvider('offline')); }, []);
  async function createKey() { setError(''); try { const r=await fetch(`${API}/admin/keys`,{method:'POST',headers:{Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json'},body:JSON.stringify({name:keyName})}); const d=await r.json(); if(!r.ok)throw new Error(d.error?.message??'Could not create API key'); setKey(d.key); } catch(e:any) { setError(e.message); } }
  async function loadModels() { setError(''); try { const r=await fetch(`${API}/v1/models`,{headers:{Authorization:`Bearer ${key}`}}); const d=await r.json(); if(!r.ok)throw new Error(d.error?.message??'Could not load models'); const ids=d.data.map((x:{id:string})=>x.id); setModels(ids); setModel(ids[0]??''); } catch(e:any) { setError(e.message); } }
  async function ask() { setBusy(true); setAnswer(''); setError(''); try { const r=await fetch(`${API}/v1/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:prompt}]})}); const d=await r.json(); if(!r.ok)throw new Error(d.error?.message??'Inference provider unavailable'); setAnswer(d.choices?.[0]?.message?.content??'Empty response'); } catch(e:any) { setError(e.message); } finally { setBusy(false); } }
  return <main><aside><div className="brand"><span>✦</span> PAI Gateway</div><nav><a className="active">Overview</a><a>OAuth session</a><a>API Keys</a><a>Playground</a><a>Logs</a></nav><small>LOCAL INSTANCE<br/><i></i> Operational</small></aside><section><header><div><p className="eyebrow">PERSONAL AI INFRASTRUCTURE</p><h1>Gateway overview</h1><p className="muted">A controlled bridge between your clients and authorized inference.</p></div><div className="pill">● {provider}</div></header><div className="grid"><article><label>REQUESTS TODAY</label><strong>—</strong><span className="up">Local metrics</span></article><article><label>AVG. LATENCY</label><strong>—</strong><span>Awaiting traffic</span></article><article><label>AUTHORIZATION</label><strong className="green">{provider==='authorized-oauth'?'Active':provider}</strong><span>{account||'Checking OAuth session'}</span></article></div><div className="columns"><article className="panel"><div className="panelhead"><div><label>PLAYGROUND</label><h2>Test your gateway</h2></div><span className="dot">● {models.length?`${models.length} models`:'create or load a key'}</span></div><div className="adminrow"><input value={keyName} onChange={e=>setKeyName(e.target.value)} placeholder="API key name"/><input type="password" value={adminToken} onChange={e=>setAdminToken(e.target.value)} placeholder="ADMIN_TOKEN"/><button className="secondary" onClick={createKey} disabled={!adminToken||!keyName}>Create API key</button></div><div className="keyrow"><input value={key} onChange={e=>setKey(e.target.value)} placeholder="pai_ API key"/><button className="secondary" onClick={loadModels} disabled={!key}>Load models</button></div><select value={model} onChange={e=>setModel(e.target.value)} disabled={!models.length}><option value="">Select an authorized model</option>{models.map(id=><option key={id} value={id}>{id}</option>)}</select><textarea value={prompt} onChange={e=>setPrompt(e.target.value)}/><button onClick={ask} disabled={busy||!key||!model}>{busy?'Running…':'Run completion →'}</button><div className={`result ${error?'error':''}`}>{error||answer||'Create or paste a key, load models, then run a completion.'}</div></article><article className="panel"><label>SECURITY MODEL</label><h2>Designed for local control.</h2><p className="muted">OAuth credentials never leave the authorized provider boundary. Clients receive only a revocable, hashed gateway key.</p><div className="line"><b>01</b><span>Bearer key verification</span><em>enabled</em></div><div className="line"><b>02</b><span>Request audit trail</span><em>enabled</em></div><div className="line"><b>03</b><span>Remote OAuth proxying</span><em className="off">disabled</em></div></article></div></section></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);

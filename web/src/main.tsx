import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = 'http://127.0.0.1:3333';
const SAVED_KEYS_STORAGE = 'pai-gateway.saved-api-keys';
const ACTIVE_KEY_STORAGE = 'pai-gateway.active-api-key';
type SavedApiKey = { id: string; name: string; key: string; createdAt: string };

function readSavedKeys(): SavedApiKey[] {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEYS_STORAGE) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is SavedApiKey => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.key === 'string') : [];
  } catch { return []; }
}

function Icon({ name }: { name: 'grid' | 'shield' | 'key' | 'play' | 'activity' | 'settings' | 'arrow' | 'copy' | 'trash' }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    shield: <><path d="M12 3 20 6v5c0 5.2-3.4 8.8-8 10-4.6-1.2-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-2 2 2 2m-5 1 2 2"/></>,
    play: <path d="m9 6 10 6-10 6V6Z"/>,
    activity: <path d="M3 12h4l2.2-6 4.2 12 2.2-6H21"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L9 6.6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1h2.6v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    copy: <><rect x="8" y="8" width="10" height="10" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    trash: <><path d="M4 7h16m-10 4v5m4-5v5M9 7V4h6v3m-9 0 1 14h10l1-14"/></>
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const [prompt, setPrompt] = useState('Explique esta arquitetura em uma frase.');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedKeys, setSavedKeys] = useState<SavedApiKey[]>(() => readSavedKeys());
  const [key, setKeyState] = useState(() => localStorage.getItem(ACTIVE_KEY_STORAGE) ?? '');
  const [adminToken, setAdminToken] = useState('');
  const [keyName, setKeyName] = useState('dashboard-client');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState('checking');
  const [account, setAccount] = useState('');

  function setKey(value: string) { setKeyState(value); if (value) localStorage.setItem(ACTIVE_KEY_STORAGE, value); else localStorage.removeItem(ACTIVE_KEY_STORAGE); }
  function removeSavedKey(id: string) { const removed = savedKeys.find(item => item.id === id); const next = savedKeys.filter(item => item.id !== id); setSavedKeys(next); localStorage.setItem(SAVED_KEYS_STORAGE, JSON.stringify(next)); if (removed?.key === key) setKey(''); }
  function maskKey(value: string) { return value ? `${value.slice(0, 8)}••••••${value.slice(-4)}` : ''; }
  function clearResult() { setError(''); setAnswer(''); }

  useEffect(() => { Promise.all([fetch(`${API}/health`).then(r => r.json()), fetch(`${API}/auth/chatgpt/status`).then(r => r.json())]).then(([h, s]) => { setProvider(h.provider ?? 'unknown'); setAccount(s.account ?? 'OAuth session'); }).catch(() => setProvider('offline')); }, []);
  async function createKey() { setError(''); try { const r = await fetch(`${API}/admin/keys`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: keyName }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error?.message ?? 'Could not create API key'); const saved: SavedApiKey = { id: d.id, name: d.name, key: d.key, createdAt: new Date().toISOString() }; const next = [saved, ...savedKeys.filter(item => item.id !== saved.id)]; setSavedKeys(next); localStorage.setItem(SAVED_KEYS_STORAGE, JSON.stringify(next)); setKey(d.key); } catch (e: any) { setError(e.message); } }
  async function loadModels() { setError(''); try { const r = await fetch(`${API}/v1/models`, { headers: { Authorization: `Bearer ${key}` } }); const d = await r.json(); if (!r.ok) throw new Error(d.error?.message ?? 'Could not load models'); const ids = d.data.map((x: { id: string }) => x.id); setModels(ids); setModel(ids[0] ?? ''); } catch (e: any) { setError(e.message); } }
  async function ask() { setBusy(true); clearResult(); try { const r = await fetch(`${API}/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error?.message ?? 'Inference provider unavailable'); setAnswer(d.choices?.[0]?.message?.content ?? 'Empty response'); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }

  const providerLabel = provider === 'authorized-oauth' ? 'OAuth autorizado' : provider === 'checking' ? 'Verificando' : provider;
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✦</span><span>pai<span className="brand-muted">/</span>gateway</span></div>
      <div className="workspace-label">WORKSPACE</div><div className="workspace"><span className="workspace-avatar">P</span><span>Personal Gateway</span><span className="chevron">⌄</span></div>
      <nav className="nav"><div className="nav-section">WORKSPACE</div><a className="active"><Icon name="grid" />Gateway dashboard</a></nav>
      <div className="sidebar-footer"><div className="status-line"><span className="status-dot"></span><span>Local instance</span><span className="status-ok">online</span></div><div className="version">v0.1.0 · 127.0.0.1</div></div>
    </aside>
    <section className="content">
      <header id="overview" className="topbar"><div><div className="breadcrumb">PRIVATE INFRASTRUCTURE <span>/</span> DASHBOARD</div><h1>Good morning, Bruno.</h1><p className="subtitle">A clear view of your private inference gateway.</p></div><div className="topbar-actions"><div className="connection"><span className="status-dot"></span><span>{providerLabel}</span></div><button className="avatar">BM</button></div></header>
      <div className="overview-grid"><article className="metric-card"><div className="metric-label">GATEWAY STATUS <span className="metric-icon"><Icon name="activity" /></span></div><div className="metric-value live">Operational</div><div className="metric-note"><span className="status-dot"></span> Listening on localhost</div></article><article id="oauth" className="metric-card"><div className="metric-label">AUTHORIZED PROVIDER <span className="metric-icon"><Icon name="shield" /></span></div><div className="metric-value">{provider === 'authorized-oauth' ? 'ChatGPT' : 'Mock provider'}</div><div className="metric-note">{account || 'OAuth session not connected'}</div></article><article className="metric-card"><div className="metric-label">ACTIVE API KEYS <span className="metric-icon"><Icon name="key" /></span></div><div className="metric-value">{savedKeys.length.toString().padStart(2, '0')}</div><div className="metric-note">Stored in this browser</div></article></div>
      <div className="section-heading"><div><div className="eyebrow">PRIVATE PLAYGROUND</div><h2>Test your gateway</h2><p>Send a request through your configured inference provider.</p></div><div className="model-badge"><span className="status-dot"></span>{models.length ? `${models.length} models loaded` : 'No model loaded'}</div></div>
      <div className="main-grid"><article id="keys" className="playground-card card"><div className="card-topline"><div><div className="card-kicker">01 <span>AUTHENTICATION</span></div><h3>Choose an API key</h3></div><span className="secure-badge"><Icon name="shield" /> Hashed at rest</span></div><div className="form-grid"><div className="field"><label>KEY NAME</label><div className="input-wrap"><input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="dashboard-client" /></div></div><div className="field"><label>ADMIN TOKEN</label><div className="input-wrap"><input type="password" value={adminToken} onChange={e => setAdminToken(e.target.value)} placeholder="Required to create a key" /></div></div></div><button className="primary-button full" onClick={createKey} disabled={!adminToken || !keyName}>Create new API key <Icon name="arrow" /></button>{savedKeys.length > 0 && <div className="saved-list"><div className="list-heading"><span>SAVED KEYS</span><span>{savedKeys.length} available</span></div>{savedKeys.map(item => <div className={`saved-row ${item.key === key ? 'selected' : ''}`} key={item.id}><button className="saved-select" onClick={() => setKey(item.key)}><span className="key-symbol"><Icon name="key" /></span><span className="saved-copy"><strong>{item.name}</strong><small>{maskKey(item.key)}</small></span>{item.key === key && <span className="selected-label">ACTIVE</span>}</button><button className="icon-button" onClick={() => navigator.clipboard?.writeText(item.key)} title="Copy key"><Icon name="copy" /></button><button className="icon-button danger" onClick={() => removeSavedKey(item.id)} title="Remove key"><Icon name="trash" /></button></div>)}</div>}<div className="divider"><span>or paste an existing key</span></div><div className="key-input-row"><input value={key} onChange={e => setKey(e.target.value)} placeholder="pai_..." /><button className="secondary-button" onClick={loadModels} disabled={!key}>Load models <Icon name="arrow" /></button></div></article>
        <article className="request-card card"><div className="card-topline"><div><div className="card-kicker">02 <span>REQUEST</span></div><h3>Run a completion</h3></div><span className="method-badge">POST</span></div><div className="field"><label>MODEL</label><select value={model} onChange={e => setModel(e.target.value)} disabled={!models.length}><option value="">Load a key to see models</option>{models.map(id => <option key={id} value={id}>{id}</option>)}</select></div><div className="field prompt-field"><div className="label-row"><label>PROMPT</label><span>TEXT</span></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} /></div><button className="primary-button full" onClick={ask} disabled={busy || !key || !model}><Icon name="play" />{busy ? 'Running request…' : 'Run completion'}<span className="button-shortcut">⌘ ↵</span></button><div className={`response-box ${error ? 'has-error' : ''}`}><div className="response-header"><span><span className="response-dot"></span> RESPONSE</span><span>{error ? 'ERROR' : answer ? '200 OK' : 'WAITING'}</span></div><div className="response-content">{error || answer || 'Your model response will appear here.'}</div></div></article>
      </div>
      <div className="main-grid utility-grid"><article id="usage" className="utility-card card"><div className="metric-label">USAGE & LOGS <Icon name="activity" /></div><h3>Request activity</h3><p>Audit data is recorded locally by the gateway. Open the API usage endpoint to inspect totals and latency.</p><code>GET /v1/usage</code></article><article id="settings" className="utility-card card"><div className="metric-label">SETTINGS <Icon name="settings" /></div><h3>Local configuration</h3><p>Provider: <strong>{providerLabel}</strong><br />Host: <strong>127.0.0.1:3333</strong></p><span className="settings-hint">Edit values in your .env file and restart the gateway.</span></article></div>
      <div className="bottom-note"><Icon name="shield" /><span>Your OAuth credentials never leave the provider boundary. API keys are revocable and stored locally.</span></div>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);

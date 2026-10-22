import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashSecret } from './security.js';
export type Db = ReturnType<typeof openDb>;
export function openDb(path = process.env.DATABASE_PATH ?? './data/gateway.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path); db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, secret_hash TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, revoked_at TEXT, request_limit INTEGER, permissions TEXT NOT NULL, request_count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, key_id TEXT, model TEXT, status INTEGER NOT NULL, duration_ms INTEGER NOT NULL, created_at TEXT NOT NULL, error TEXT);`);
  return db;
}
export function findKey(db: Db, raw: string) { return db.prepare('SELECT * FROM api_keys WHERE secret_hash = ? AND revoked_at IS NULL').get(hashSecret(raw)) as any; }
export function record(db: Db, keyId: string|undefined, model: string, status: number, duration: number, error?: string) { db.prepare('INSERT INTO requests(key_id,model,status,duration_ms,created_at,error) VALUES(?,?,?,?,?,?)').run(keyId ?? null, model, status, duration, new Date().toISOString(), error ?? null); if(keyId) db.prepare('UPDATE api_keys SET request_count=request_count+1 WHERE id=?').run(keyId); }

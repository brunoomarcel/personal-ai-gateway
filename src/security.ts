import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export function makeApiKey() { const raw = `pai_${randomBytes(24).toString('hex')}`; return { raw, hash: hashSecret(raw) }; }
export function hashSecret(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function safeEqual(a: string, b: string) { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
export function bearer(value?: string) { return value?.match(/^Bearer\s+(.+)$/i)?.[1]; }

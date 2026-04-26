import type { Env, DomainRow, EventRow } from "./types";

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export async function ensureAdmin(env: Env): Promise<void> {
  const email = env.ADMIN_EMAIL?.trim();
  const pass = env.ADMIN_PASSWORD;
  if (!email || !pass) {
    // Can't auto-create without secrets
    return;
  }
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{id: number}>();
  if (row?.id) return;

  // Create admin with PBKDF2
  const { pbkdf2Hash, b64, randomBytes } = await import("./crypto");
  const salt = randomBytes(16);
  const hash = await pbkdf2Hash(pass, salt);
  const created = nowSec();
  await env.DB.prepare(
    "INSERT INTO users(email, salt_b64, hash_b64, created_at) VALUES(?,?,?,?)"
  ).bind(email, b64(salt), b64(hash), created).run();

  await addEvent(env, null, "info", `Admin bootstrap user created: ${email}`);
}

export async function addEvent(env: Env, domainId: number | null, type: string, message: string): Promise<void> {
  await env.DB.prepare("INSERT INTO events(domain_id, type, message, created_at) VALUES(?,?,?,?)")
    .bind(domainId, type, message, nowSec())
    .run();
}

export async function listDomains(env: Env): Promise<DomainRow[]> {
  const res = await env.DB.prepare("SELECT * FROM domains ORDER BY created_at DESC").all<DomainRow>();
  return res.results ?? [];
}

export async function listEvents(env: Env, limit = 200): Promise<EventRow[]> {
  const res = await env.DB.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ?").bind(limit).all<EventRow>();
  return res.results ?? [];
}

export async function getDomainById(env: Env, id: number): Promise<DomainRow | null> {
  const row = await env.DB.prepare("SELECT * FROM domains WHERE id = ?").bind(id).first<DomainRow>();
  return row ?? null;
}

export async function getDomainByName(env: Env, domain: string): Promise<DomainRow | null> {
  const row = await env.DB.prepare("SELECT * FROM domains WHERE domain = ?").bind(domain).first<DomainRow>();
  return row ?? null;
}

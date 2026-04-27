import type { Env, DomainRow, EventRow } from "./types";

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

// SEC-07: Cheap fingerprint to detect password rotation without running PBKDF2 on every request
async function quickHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureAdmin(env: Env): Promise<void> {
  const email = env.ADMIN_EMAIL?.trim();
  const pass = env.ADMIN_PASSWORD;
  if (!email || !pass) return;

  // Fast path: SHA-256 fingerprint check (<1ms) to avoid PBKDF2 on every request
  const fingerprint = await quickHash(pass);
  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_pw_fingerprint'")
    .first<{value: string}>();

  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{id: number}>();

  if (row?.id && stored?.value === fingerprint) {
    // User exists and password hasn't changed — nothing to do
    return;
  }

  // Slow path: password changed or first boot — run PBKDF2
  const { pbkdf2Hash, b64, randomBytes } = await import("./crypto");
  const salt = randomBytes(16);
  const hash = await pbkdf2Hash(pass, salt);

  if (row?.id) {
    // Password was rotated in Cloudflare secrets — update hash & kill all sessions
    await env.DB.prepare("UPDATE users SET salt_b64 = ?, hash_b64 = ? WHERE id = ?")
      .bind(b64(salt), b64(hash), row.id).run();
    await env.DB.prepare("DELETE FROM sessions").run();
    await addEvent(env, null, "info", `Admin password rotated for ${email}. All sessions invalidated.`);
  } else {
    // First time bootstrap
    await env.DB.prepare(
      "INSERT INTO users(email, salt_b64, hash_b64, created_at) VALUES(?,?,?,?)"
    ).bind(email, b64(salt), b64(hash), nowSec()).run();
    await addEvent(env, null, "info", `Admin bootstrap user created: ${email}`);
  }

  // Store fingerprint for future fast-path checks
  await env.DB.prepare(
    "INSERT INTO settings(key, value, updated_at) VALUES('admin_pw_fingerprint', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(fingerprint, nowSec()).run();
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

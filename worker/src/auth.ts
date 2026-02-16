import type { Env } from "./types";
import { nowSec } from "./db";
import { pbkdf2Hash, unb64, timingSafeEqual, randomToken } from "./crypto";

const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export type AuthedUser = { id: number; email: string };

export function getSessionTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|; )bo_session=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  const h = req.headers.get("authorization");
  if (h && h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return null;
}

export async function requireAuth(env: Env, req: Request): Promise<AuthedUser | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;

  const row = await env.DB.prepare(
    "SELECT s.user_id as id, u.email as email, s.expires_at as expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(token).first<{id:number,email:string,expires_at:number}>();

  if (!row) return null;
  if (row.expires_at < nowSec()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  return { id: row.id, email: row.email };
}

export async function login(env: Env, emailIn: string, password: string): Promise<{ token: string } | null> {
  const email = emailIn.trim().toLowerCase();
  const user = await env.DB.prepare("SELECT id, email, salt_b64, hash_b64 FROM users WHERE email = ?")
    .bind(email).first<{id:number,email:string,salt_b64:string,hash_b64:string}>();
  if (!user) return null;

  const salt = unb64(user.salt_b64);
  const expected = unb64(user.hash_b64);
  const got = await pbkdf2Hash(password, salt);
  if (!timingSafeEqual(expected, got)) return null;

  const token = randomToken();
  const now = nowSec();
  const exp = now + SESSION_TTL_SEC;
  await env.DB.prepare("INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?,?,?,?)")
    .bind(token, user.id, exp, now).run();

  return { token };
}

export async function logout(env: Env, token: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

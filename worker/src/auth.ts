import type { Env } from "./types";
import { nowSec } from "./db";
import { pbkdf2Hash, unb64, timingSafeEqual, randomToken, sha256Base64Url } from "./crypto";

const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
export const SESSION_COOKIE_NAME = "__Host-bo_session";
const LEGACY_SESSION_COOKIE_NAME = "bo_session";

export type AuthedUser = { id: number; email: string };

export function getSessionTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]+)`));
  if (m) return decodeURIComponent(m[1]);

  const legacy = cookie.match(new RegExp(`(?:^|; )${LEGACY_SESSION_COOKIE_NAME}=([^;]+)`));
  if (legacy) return decodeURIComponent(legacy[1]);

  const h = req.headers.get("authorization");
  if (h && h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return null;
}

export async function requireAuth(env: Env, req: Request): Promise<AuthedUser | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  const tokenHash = await sha256Base64Url(token);

  const row = await env.DB.prepare(
    "SELECT s.user_id as id, u.email as email, s.expires_at as expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(tokenHash).first<{id:number,email:string,expires_at:number}>();

  if (!row) return null;
  if (row.expires_at < nowSec()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(tokenHash).run();
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
  const tokenHash = await sha256Base64Url(token);
  const now = nowSec();
  const exp = now + SESSION_TTL_SEC;
  await env.DB.prepare("INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?,?,?,?)")
    .bind(tokenHash, user.id, exp, now).run();

  return { token };
}

export async function logout(env: Env, token: string): Promise<void> {
  const tokenHash = await sha256Base64Url(token);
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(tokenHash).run();
}

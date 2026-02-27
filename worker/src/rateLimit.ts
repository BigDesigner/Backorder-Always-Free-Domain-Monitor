import type { Env } from "./types";

const WINDOW_SEC = 60;
const MAX_ATTEMPTS = 5;
const BLOCK_SEC = 10 * 60;

export type RateLimitResult = {
  ok: boolean;
  retryAfterSec?: number;
};

export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  if (first) return first;

  return "unknown";
}

export async function checkLoginRateLimit(env: Env, ip: string, now: number): Promise<RateLimitResult> {
  const key = normalizeIp(ip);
  const row = await env.DB.prepare(
    "SELECT window_start, attempt_count, blocked_until FROM login_rate_limits WHERE ip = ?"
  ).bind(key).first<{ window_start: number; attempt_count: number; blocked_until: number | null }>();

  if (!row) return { ok: true };

  if (row.blocked_until && row.blocked_until > now) {
    return { ok: false, retryAfterSec: Math.max(1, row.blocked_until - now) };
  }

  return { ok: true };
}

export async function registerLoginFailure(env: Env, ip: string, now: number): Promise<void> {
  const key = normalizeIp(ip);
  const row = await env.DB.prepare(
    "SELECT window_start, attempt_count, blocked_until FROM login_rate_limits WHERE ip = ?"
  ).bind(key).first<{ window_start: number; attempt_count: number; blocked_until: number | null }>();

  const windowStart = Math.floor(now / WINDOW_SEC) * WINDOW_SEC;

  if (!row) {
    await env.DB.prepare(
      "INSERT INTO login_rate_limits(ip, window_start, attempt_count, blocked_until, updated_at) VALUES(?,?,?,?,?)"
    ).bind(key, windowStart, 1, null, now).run();
    return;
  }

  const sameWindow = row.window_start === windowStart;
  const attemptCount = sameWindow ? row.attempt_count + 1 : 1;
  const blockedUntil = attemptCount >= MAX_ATTEMPTS ? now + BLOCK_SEC : null;

  await env.DB.prepare(
    "UPDATE login_rate_limits SET window_start = ?, attempt_count = ?, blocked_until = ?, updated_at = ? WHERE ip = ?"
  ).bind(windowStart, attemptCount, blockedUntil, now, key).run();
}

export async function clearLoginFailures(env: Env, ip: string): Promise<void> {
  const key = normalizeIp(ip);
  await env.DB.prepare("DELETE FROM login_rate_limits WHERE ip = ?").bind(key).run();
}

function normalizeIp(ip: string): string {
  const normalized = ip.trim().toLowerCase();
  return normalized || "unknown";
}

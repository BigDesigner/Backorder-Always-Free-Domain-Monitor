import type { Env, DomainRow } from "./types";
import { nowSec, addEvent } from "./db";
import { checkDomain } from "./rdap";
import { notifyAll } from "./notify";

/**
 * Adaptive backoff:
 * - if 429: exponentially backoff per domain (6h -> 12h -> 24h max)
 * - if repeated errors: backoff (2h -> 6h -> 12h max)
 * - otherwise: interval = check_interval_min (default 60)
 */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hours(n: number): number { return n * 3600; }

export async function runScheduler(env: Env): Promise<{ checked: number; due: number }> {
  const now = nowSec();

  const dueRes = await env.DB.prepare(
    "SELECT * FROM domains WHERE enabled = 1 AND next_check_at <= ? ORDER BY next_check_at ASC LIMIT 50"
  ).bind(now).all<DomainRow>();

  const due = dueRes.results ?? [];
  let checked = 0;

  for (const d of due) {
    checked++;
    await env.DB.prepare("UPDATE domains SET last_checked_at = ? WHERE id = ?").bind(now, d.id).run();

    try {
      const res = await checkDomain(env, d.domain);
      if (res.ok) {
        const prev = d.last_status || "unknown";
        const status = res.status;
        let nextIntervalMin = clamp(d.check_interval_min, 30, 24*60);

        // [FEAT-01] Dynamic Scaling based on Lifecycle
        if (status === "registered" && res.payload) {
          const rdapStatus = (res.payload as any).status || [];
          const isPendingDelete = rdapStatus.some((s: string) => s.toLowerCase().includes("pending delete"));
          const isRedemption = rdapStatus.some((s: string) => s.toLowerCase().includes("redemption"));

          if (isPendingDelete) {
            // Speed up to 15 mins (very aggressive but safe for most RDAP)
            nextIntervalMin = 15;
            await addEvent(env, d.id, "info", `⚡ Speeding up! ${d.domain} is in PENDING DELETE. Checking every 15m.`);
          } else if (isRedemption) {
            // Speed up to 60 mins if user set it slower
            nextIntervalMin = Math.min(nextIntervalMin, 60);
          }
        }

        let expiresAt: number | null = null;
        if (status === "registered" && res.payload) {
          const events = (res.payload as any).events || [];
          const expiryEvent = events.find((e: any) => e.eventAction === "expiration");
          if (expiryEvent && expiryEvent.eventDate) {
            try {
              expiresAt = Math.floor(new Date(expiryEvent.eventDate).getTime() / 1000);
            } catch {
              expiresAt = null;
            }
          }
        }

        const next = now + nextIntervalMin * 60;

        await env.DB.prepare(
          "UPDATE domains SET last_status=?, last_rdap_http=?, last_error=NULL, consecutive_errors=0, next_check_at=?, expires_at=? WHERE id=?"
        ).bind(status, res.http, next, expiresAt, d.id).run();

        if (status !== prev) {
          await addEvent(env, d.id, status, `${d.domain} status changed: ${prev} -> ${status} (HTTP ${res.http})`);

          if (status === "available") {
            const msg = `✅ DOMAIN AVAILABLE: ${d.domain}\nDetected: ${new Date().toISOString()}\nRDAP: HTTP ${res.http}`;
            await notifyAll(env, msg);
          }
        }
      } else {
        if (res.status === "rate_limited") {
          const prevErrs = d.consecutive_errors ?? 0;
          const step = clamp(prevErrs + 1, 1, 4); // 1..4
          const delay = [hours(6), hours(12), hours(24), hours(24)][step - 1];
          const next = now + delay;

          await env.DB.prepare(
            "UPDATE domains SET last_status=?, last_rdap_http=?, last_error=?, consecutive_errors=?, next_check_at=? WHERE id=?"
          ).bind("rate_limited", res.http, `429 rate limited${res.retryAfterSec ? `; retry-after=${res.retryAfterSec}s` : ""}`, step, next, d.id).run();

          await addEvent(env, d.id, "rate_limited", `${d.domain} RDAP rate-limited (HTTP 429). Backing off ${Math.round(delay/3600)}h.`);
        } else {
          const prevErrs = d.consecutive_errors ?? 0;
          const step = clamp(prevErrs + 1, 1, 4);
          const delay = [hours(2), hours(6), hours(12), hours(12)][step - 1];
          const next = now + delay;

          await env.DB.prepare(
            "UPDATE domains SET last_status=?, last_rdap_http=?, last_error=?, consecutive_errors=?, next_check_at=? WHERE id=?"
          ).bind("error", res.http, res.error, step, next, d.id).run();

          await addEvent(env, d.id, "error", `${d.domain} RDAP error (HTTP ${res.http}). Backing off ${Math.round(delay/3600)}h. ${res.error}`);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const prevErrs = d.consecutive_errors ?? 0;
      const step = clamp(prevErrs + 1, 1, 4);
      const delay = [hours(2), hours(6), hours(12), hours(12)][step - 1];
      const next = now + delay;

      await env.DB.prepare(
        "UPDATE domains SET last_status=?, last_rdap_http=NULL, last_error=?, consecutive_errors=?, next_check_at=? WHERE id=?"
      ).bind("error", msg, step, next, d.id).run();
      await addEvent(env, d.id, "error", `${d.domain} scheduler exception. Backing off ${Math.round(delay/3600)}h. ${msg}`);
    }
  }

  return { checked, due: due.length };
}

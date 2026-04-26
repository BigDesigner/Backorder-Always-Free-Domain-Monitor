import type { Env } from "./types";

export type RdapResult =
  | { ok: true; status: "registered"; http: number; payload?: unknown }
  | { ok: true; status: "available"; http: number }
  | { ok: false; status: "rate_limited"; http: number; retryAfterSec?: number }
  | { ok: false; status: "error"; http: number; error: string };

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function checkDomain(env: Env, domainIn: string): Promise<RdapResult> {
  const domain = normalizeDomain(domainIn);
  const base = (env.RDAP_BASE && env.RDAP_BASE.trim()) || "https://rdap.org/domain/";
  const url = base.endsWith("/") ? base + domain : base + "/" + domain;

  // Conservative headers
  const resp = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "backorder-domain-monitor/1.0 (Cloudflare Worker)"
    }
  });

  const http = resp.status;

  if (http === 404) {
    // Most RDAP servers return 404 when not found (interpreted as available)
    return { ok: true, status: "available", http };
  }
  if (http === 429) {
    const ra = resp.headers.get("retry-after");
    const retryAfterSec = ra ? parseInt(ra, 10) : undefined;
    return { ok: false, status: "rate_limited", http, retryAfterSec: Number.isFinite(retryAfterSec) ? retryAfterSec : undefined };
  }
  if (http >= 200 && http < 300) {
    // Registered
    // Keep payload small — only parse if needed
    let payload: unknown = undefined;
    try {
      payload = await resp.json();
    } catch {
      payload = undefined;
    }
    return { ok: true, status: "registered", http, payload };
  }

  const txt = await resp.text().catch(() => "");
  return { ok: false, status: "error", http, error: txt.slice(0, 600) || `RDAP unexpected status: ${http}` };
}

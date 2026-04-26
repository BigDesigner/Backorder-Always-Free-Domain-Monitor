import type { Env } from "./types";

export type RdapResult =
  | { ok: true; status: "registered"; http: number; payload?: unknown }
  | { ok: true; status: "available"; http: number }
  | { ok: false; status: "rate_limited"; http: number; retryAfterSec?: number }
  | { ok: false; status: "error"; http: number; error: string };

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const RDAP_PROVIDERS = [
  "https://rdap.org/domain/",
  "https://rdap.nic.google/domain/",
  "https://rdap.db.ripe.net/domain/",
  "https://rdap.apnic.net/domain/",
  "https://rdap.iana.org/domain/"
];

const TLD_SPECIFIC_PROVIDERS: Record<string, string> = {
  "com": "https://rdap.verisign.com/com/v1/domain/",
  "net": "https://rdap.verisign.com/net/v1/domain/",
  "org": "https://rdap.publicinterestregistry.net/rdap/domain/",
  "de": "https://rdap.denic.de/",
  "ch": "https://rdap.nic.ch/",
  "li": "https://rdap.nic.li/",
  "my": "https://rdap.mynic.my/rdap/",
  "me": "https://rdap.identitydigital.services/rdap/",
  "io": "https://rdap.identitydigital.services/rdap/",
  "sh": "https://rdap.identitydigital.services/rdap/",
  "ac": "https://rdap.identitydigital.services/rdap/",
  "sk": "https://rdap.sk-nic.sk/sk/",
  "co": "https://rdap.registry.co/co/",
  "uz": "https://rdap.cctld.uz/",
  "kg": "https://rdap.cctld.kg/",
  "si": "https://rdap.register.si/",
  "ve": "https://rdap.nic.ve/rdap/",
  "tz": "https://whois.tznic.or.tz/rdap/"
};

export async function checkDomain(env: Env, domainIn: string): Promise<RdapResult> {
  const domain = normalizeDomain(domainIn);
  const tld = domain.split(".").pop() || "";

  // 1. Pick a base URL
  let base = env.RDAP_BASE?.trim();
  if (!base) {
    // If it's a popular TLD, try direct provider first to avoid rdap.org redirection overhead
    if (TLD_SPECIFIC_PROVIDERS[tld]) {
      base = TLD_SPECIFIC_PROVIDERS[tld];
    } else {
      // Rotate between public general providers
      base = RDAP_PROVIDERS[Math.floor(Math.random() * RDAP_PROVIDERS.length)];
    }
  }

  const url = base.endsWith("/") ? base + domain : base + "/" + domain;

  // [SAFE-02] Smart Jitter: Add a random delay (100ms - 1500ms) to avoid pattern detection
  await new Promise(r => setTimeout(r, 100 + Math.random() * 1400));

  // Conservative headers
  const resp = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "Mozilla/5.0 (compatible; BackorderMonitor/1.0; +https://gnn.tr)"
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

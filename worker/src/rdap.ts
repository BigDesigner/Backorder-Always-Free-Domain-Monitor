import { connect } from "cloudflare:sockets";
import type { Env } from "./types";

export type RdapResult =
  | { ok: true; status: "registered"; http: number; payload?: unknown }
  | { ok: true; status: "available"; http: number }
  | { ok: false; status: "rate_limited"; http: number; retryAfterSec?: number }
  | { ok: false; status: "error"; http: number; error: string };

function normalizeDomain(input: string): string {
  // Strip protocol and trailing slash
  let clean = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  // SEC-13: Deep Sanitization - allow only alphanumeric, hyphen, and dot.
  // This prevents malicious path traversals (e.g., example.com/../../) from being sent to RDAP providers.
  clean = clean.replace(/[^a-z0-9.-]/g, "");
  return clean;
}

const RDAP_FALLBACK_PROVIDER = "https://rdap.org/domain/";

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

// TLD'ler için resmi RDAP servisi yok; RDAP hiç denenmeden doğrudan WHOIS'e gidilir.
const WHOIS_ONLY_TLDS = new Set(["tr"]);

const WHOIS_SERVERS: Record<string, string> = {
  "com": "whois.verisign-grs.com",
  "net": "whois.verisign-grs.com",
  "org": "whois.pir.org",
  "info": "whois.afilias.net",
  "biz": "whois.nic.biz",
  "co": "whois.nic.co",
  "io": "whois.nic.io",
  "us": "whois.nic.us",
  "cc": "whois.nic.cc",
  "tv": "whois.nic.tv",
  // whois.nic.tr artık DNS'te yok (NXDOMAIN); .tr registry'si BTK/TRABİS'e devredildi.
  // Canlı doğrulandı (2026-07-12): whois.trabis.gov.tr — IANA kaydı status ACTIVE.
  "tr": "whois.trabis.gov.tr",
  "me": "whois.nic.me",
  "sk": "whois.sk-nic.sk",
  "ch": "whois.nic.ch",
  "li": "whois.nic.ch",
  "ru": "whois.tcinet.ru",
  "uk": "whois.nic.uk",
  "de": "whois.denic.de"
};

async function queryWhoisTcp(server: string, query: string): Promise<string> {
  const socket = connect({ hostname: server, port: 43 });
  const writer = socket.writable.getWriter();
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(`${query}\r\n`));
  writer.releaseLock();

  const reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  let result = "";

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("WHOIS query timed out")), 5000);
  });

  const readPromise = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        result += decoder.decode(value, { stream: !done });
      }
      if (done) {
        break;
      }
    }
    return result;
  })();

  try {
    return await Promise.race([readPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
    try {
      await socket.close();
    } catch {
      // ignore
    }
  }
}

async function getWhoisServerForTld(tld: string): Promise<string> {
  if (WHOIS_SERVERS[tld]) {
    return WHOIS_SERVERS[tld];
  }
  try {
    const raw = await queryWhoisTcp("whois.iana.org", tld);
    const match = raw.match(/whois:\s+([a-z0-9.-]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // Ignore error
  }
  return "whois.iana.org";
}

const AVAILABLE_PATTERNS: RegExp[] = [
  /^no match found for/im,        // TRABİS (.tr) — canlı doğrulandı
  /^no match for/im,              // Verisign (.com/.net)
  /^not found/im,
  /^%+\s*no entries found/im,     // DENIC vb.
  /^no data found/im,
  /^domain not found/im,
  /^no object found/im,
  /^status:\s*(free|available)$/im,
  /^%\s*not registered/im,
];

function parseWhoisAvailability(text: string): "available" | "registered" {
  if (AVAILABLE_PATTERNS.some(re => re.test(text))) {
    return "available";
  }
  return "registered";
}

function parseWhoisExpiry(text: string): number | null {
  const expiryRegexes = [
    /(?:expiry|expiration|expires|expires\s+on)\s*[:\s]+([^\r\n]+)/i,
    /registry\s+expiry\s+date\s*[:\s]+([^\r\n]+)/i,
  ];
  for (const regex of expiryRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      const dateStr = match[1].trim();
      try {
        const time = Date.parse(dateStr);
        if (!isNaN(time)) {
          return Math.floor(time / 1000);
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export async function checkDomainWhois(domain: string): Promise<RdapResult> {
  const tld = domain.split(".").pop() || "";
  try {
    const server = await getWhoisServerForTld(tld);
    const raw = await queryWhoisTcp(server, domain);

    const status = parseWhoisAvailability(raw);
    if (status === "available") {
      return { ok: true, status: "available", http: 200 };
    }

    const expiresAt = parseWhoisExpiry(raw);
    const payload: any = { whois: true, raw };
    if (expiresAt) {
      payload.events = [
        {
          eventAction: "expiration",
          eventDate: new Date(expiresAt * 1000).toISOString()
        }
      ];
    }

    return { ok: true, status: "registered", http: 200, payload };
  } catch (e: any) {
    return { ok: false, status: "error", http: 500, error: `WHOIS fallback failed: ${e.message}` };
  }
}

export async function checkDomain(env: Env, domainIn: string): Promise<RdapResult> {
  const domain = normalizeDomain(domainIn);
  const tld = domain.split(".").pop() || "";

  // Bu TLD'ler için resmi RDAP servisi yok (ör. .tr) — RDAP'ı hiç denemeden WHOIS'e git.
  if (!env.RDAP_BASE && WHOIS_ONLY_TLDS.has(tld)) {
    return await checkDomainWhois(domain);
  }

  // 1. Pick a base URL
  let base = env.RDAP_BASE?.trim();
  if (!base) {
    base = TLD_SPECIFIC_PROVIDERS[tld] || RDAP_FALLBACK_PROVIDER;
  }

  const url = base.endsWith("/") ? base + domain : base + "/" + domain;

  // [SAFE-02] Smart Jitter: Add a random delay (100ms - 1500ms) to avoid pattern detection
  await new Promise(r => setTimeout(r, 100 + Math.random() * 1400));

  try {
    const resp = await fetch(url, {
      headers: {
        "accept": "application/json",
        "user-agent": "Mozilla/5.0 (compatible; BackorderMonitor/1.0; +https://gnn.tr)"
      }
    });

    const http = resp.status;

    if (http === 404) {
      // rdap.org gibi bootstrap redirector'lar bilinmeyen/yanlış TLD'lerde de 404 döner;
      // "available" demeden önce WHOIS ile mutabakat ara.
      const whoisResult = await checkDomainWhois(domain);
      if (whoisResult.ok) {
        return whoisResult;
      }
      // WHOIS de başarısız olduysa RDAP 404'üne güven.
      return { ok: true, status: "available", http };
    }
    if (http === 429) {
      const ra = resp.headers.get("retry-after");
      const retryAfterSec = ra ? parseInt(ra, 10) : undefined;
      return { ok: false, status: "rate_limited", http, retryAfterSec: Number.isFinite(retryAfterSec) ? retryAfterSec : undefined };
    }
    if (http >= 200 && http < 300) {
      let payload: unknown;
      try {
        payload = await resp.json();
      } catch {
        payload = undefined;
      }
      return { ok: true, status: "registered", http, payload };
    }

    // RDAP returned a non-success status code (e.g. 501, 500, 503) -> Try WHOIS fallback
    return await checkDomainWhois(domain);

  } catch (e: any) {
    // Network/DNS error fetching RDAP -> Try WHOIS fallback
    return await checkDomainWhois(domain);
  }
}

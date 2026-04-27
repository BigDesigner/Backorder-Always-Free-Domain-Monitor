export const API_BASE = "https://api.gnn.tr";

export type Domain = {
  id: number;
  domain: string;
  label: string | null;
  enabled: number;
  check_interval_min: number;
  next_check_at: number;
  last_checked_at: number | null;
  last_status: string | null;
  last_rdap_http: number | null;
  last_error: string | null;
  created_at: number;
  expires_at: number | null;
};

export type Event = {
  id: number;
  domain_id: number | null;
  type: string;
  message: string;
  created_at: number;
};

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {})
    },
    credentials: "include"
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  health: () => req<{ok:boolean;ts:string}>(`/api/health`),
  me: () => req<{ok:boolean;user:{id:number;email:string}}>(`/api/me`),
  login: (email: string, password: string) => req<{ok:boolean;token:string}>(`/api/login`, { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ok:boolean}>(`/api/logout`, { method: "POST", body: JSON.stringify({}) }),
  domains: () => req<{ok:boolean;domains:Domain[];now:number}>(`/api/domains`),
  addDomain: (domain: string, label?: string, intervalMin?: number) => req<{ok:boolean;domain:Domain}>(`/api/domains`, { method: "POST", body: JSON.stringify({ domain, label, intervalMin }) }),
  patchDomain: (id: number, patch: any) => req<{ok:boolean;domain:Domain}>(`/api/domains/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteDomain: (id: number) => req<{ok:boolean}>(`/api/domains/${id}/delete`, { method: "POST", body: JSON.stringify({}) }),
  events: (limit = 200) => req<{ok:boolean;events:Event[]}>(`/api/events?limit=${limit}`),
  testNotify: () => req<{ok:boolean}>(`/api/test-notify`, { method: "POST", body: JSON.stringify({}) })
};

export function fmtTime(tsSec: number | null | undefined): string {
  if (!tsSec || isNaN(tsSec)) return "—";
  const d = new Date(tsSec * 1000);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function relEta(tsSec: number, nowSec: number): string {
  const diff = tsSec - nowSec;
  if (diff <= 0) return "now";
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

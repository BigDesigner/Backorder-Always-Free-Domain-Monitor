export function classNames(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export function statusPill(status: string | null) {
  const s = (status || "unknown").toLowerCase();
  const map: Record<string, string> = {
    available: "border-emerald-300/20 bg-emerald-400/15 text-emerald-200",
    registered: "border-sky-300/20 bg-sky-400/15 text-sky-200",
    unknown: "border-white/10 bg-white/10 text-zinc-200",
    rate_limited: "border-amber-300/20 bg-amber-400/15 text-amber-200",
    error: "border-rose-300/20 bg-rose-400/15 text-rose-200"
  };
  return map[s] || map.unknown;
}

export function eventPill(type: string) {
  const t = type.toLowerCase();
  const map: Record<string, string> = {
    available: "border-emerald-300/20 bg-emerald-400/15 text-emerald-200",
    registered: "border-sky-300/20 bg-sky-400/15 text-sky-200",
    info: "border-white/10 bg-white/10 text-zinc-200",
    rate_limited: "border-amber-300/20 bg-amber-400/15 text-amber-200",
    error: "border-rose-300/20 bg-rose-400/15 text-rose-200",
    auth: "border-fuchsia-300/20 bg-fuchsia-400/15 text-fuchsia-200"
  };
  return map[t] || map.info;
}

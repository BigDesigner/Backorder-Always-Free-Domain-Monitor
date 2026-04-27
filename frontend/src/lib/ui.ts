export function classNames(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export function statusPill(status: string | null) {
  const s = (status || "unknown").toLowerCase();
  const map: Record<string, string> = {
    available: "text-emerald-400",
    registered: "text-sky-400",
    unknown: "text-zinc-500",
    rate_limited: "text-amber-400",
    error: "text-rose-400"
  };
  const base = "inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide shrink-0 bg-transparent border-none shadow-none";
  return classNames(base, map[s] || map.unknown);
}

export function eventPill(type: string) {
  const t = type.toLowerCase();
  const map: Record<string, string> = {
    available: "text-emerald-400",
    registered: "text-sky-400",
    info: "text-zinc-400",
    rate_limited: "text-amber-400",
    error: "text-rose-400",
    auth: "text-fuchsia-400"
  };
  const base = "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shrink-0 bg-transparent border-none shadow-none";
  return classNames(base, map[t] || map.info);
}

import React, { useEffect, useMemo, useState } from "react";
import { api, Domain, Event, fmtTime, relEta } from "./lib/api";
import { classNames, statusPill, eventPill } from "./lib/ui";
import { Modal } from "./components/Modal";
import { ToastProvider, useToast } from "./components/Toast";

function Shell() {
	useEffect(() => {
  const t = setInterval(() => {
    window.location.reload();
  }, 300_000); // 300 seconds

  return () => clearInterval(t);
}, []);
	
  const toast = useToast();

  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [domains, setDomains] = useState<Domain[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [now, setNow] = useState<number>(Math.floor(Date.now()/1000));

  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newInterval, setNewInterval] = useState(60);

  const [tab, setTab] = useState<"dashboard" | "activity" | "about">("dashboard");

  async function refreshAll() {
    try {
      const d = await api.domains();
      setDomains(d.domains || []);
      setNow(d.now || Math.floor(Date.now()/1000));
      const e = await api.events(250);
      setEvents(e.events || []);
    } catch (err) {
      console.error("Refresh failed", err);
      setAuthed(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await api.health();
        await api.me();
        setAuthed(true);
        await refreshAll();
      } catch {
        setAuthed(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => refreshAll().catch(() => {}), 30_000);
    return () => clearInterval(t);
  }, [authed]);

  const stats = useMemo(() => {
    const safeDomains = domains || [];
    const total = safeDomains.length;
    const enabled = safeDomains.filter(d => d.enabled === 1).length;
    const available = safeDomains.filter(d => (d.last_status || "").toLowerCase() === "available").length;
    const rateLimited = safeDomains.filter(d => (d.last_status || "") === "rate_limited").length;
    const errors = safeDomains.filter(d => (d.last_status || "") === "error").length;
    return { total, enabled, available, rateLimited, errors };
  }, [domains]);

  async function doLogin() {
    try {
      await api.login(email, password);
      setAuthed(true);
      toast.push("Signed in.");
      await refreshAll();
    } catch (e: any) {
      toast.push(e?.message || "Login failed");
    }
  }

  async function doLogout() {
    await api.logout().catch(() => {});
    setAuthed(false);
    setDomains([]);
    setEvents([]);
    toast.push("Signed out.");
  }

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDomain) return;
    try {
      await api.addDomain(newDomain, newLabel || undefined, newInterval || undefined);
      setNewDomain("");
      setNewLabel("");
      toast.push(`Added ${newDomain}`);
      await refreshAll();
    } catch (e: any) {
      toast.push(e.message);
    }
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    const domains = bulkInput.split(/[\n,]+/).map(d => d.trim()).filter(d => d && d.includes("."));
    if (domains.length === 0) {
      toast.push("No valid domains found in input");
      return;
    }
    
    try {
      toast.push(`Importing ${domains.length} domains...`);
      const res = await api.bulkAddDomains(domains, newInterval || undefined);
      setBulkInput("");
      setBulkMode(false);
      toast.push(`Done: ${res.results.added} added, ${res.results.skipped} skipped.`);
      await refreshAll();
    } catch (e: any) {
      toast.push(e.message);
    }
  }

  async function toggleDomain(d: Domain) {
    await api.patchDomain(d.id, { enabled: d.enabled !== 1 }).catch((e:any) => toast.push(e?.message || "Failed"));
    await refreshAll();
  }

  async function forceCheck(d: Domain) {
    await api.patchDomain(d.id, { forceCheck: true }).catch((e:any) => toast.push(e?.message || "Failed"));
    toast.push("Forced check queued.");
    await refreshAll();
  }

  async function removeDomain(d: Domain) {
    if (!confirm(`Are you sure you want to remove ${d.domain}?`)) return;
    
    try {
      toast.push(`Attempting to delete ID: ${d.id}...`);
      await api.deleteDomain(d.id);
      
      // Wait a bit longer for sync
      await new Promise(r => setTimeout(r, 800));
      
      toast.push("Successfully removed.");
      await refreshAll();
    } catch (e: any) {
      console.error("Delete failed:", e);
      toast.push(`Error: ${e.message || "Deletion failed"}`);
    }
  }

  async function setIntervalMin(d: Domain, minutes: number) {
    await api.patchDomain(d.id, { intervalMin: minutes }).catch((e:any) => toast.push(e?.message || "Failed"));
    await refreshAll();
  }

  function TopBar() {
    return (
      <div className="sticky top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center shadow-soft2">
              <span className="text-lg font-bold">BO</span>
            </div>
            <div>
              <div className="font-semibold leading-tight">Backorder</div>
              <div className="text-xs text-zinc-400">Always‑free domain monitor</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className={classNames("btn", tab==="dashboard" && "bg-white/20")} onClick={() => setTab("dashboard")}>Dashboard</button>
            <button className={classNames("btn", tab==="activity" && "bg-white/20")} onClick={() => setTab("activity")}>Activity</button>
            <button className={classNames("btn", tab==="settings" && "bg-white/20")} onClick={() => setTab("settings")}>Settings</button>
            {authed && <button className="btn" onClick={() => setAddOpen(true)}>+ Add</button>}
            {authed && <button className="btn" onClick={doLogout}>Logout</button>}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950">
        <div className="card p-6 text-center">
          <div className="text-xl font-semibold">Loading…</div>
          <div className="text-sm text-zinc-400 mt-1">Warming up the Worker API</div>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <TopBar />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div className="card p-6 glow bg-grid">
              <div className="text-3xl font-semibold">Monitor domains safely.</div>
              <div className="text-zinc-300 mt-2 leading-relaxed">
                Hourly checks (24×/day) with adaptive backoff on rate limits.
                Get instant signals via Telegram/Discord (optional).
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="card p-4">
                  <div className="text-zinc-400">Checks</div>
                  <div className="font-semibold">24×/day (default)</div>
                </div>
                <div className="card p-4">
                  <div className="text-zinc-400">Safety</div>
                  <div className="font-semibold">Auto backoff</div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-xl font-bold mb-4">Admin Sign-in</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                  <input className="input" placeholder="admin@gnn.tr" value={email} onChange={(e)=>setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
                  <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e)=>setPassword(e.target.value)} />
                </div>
                <button className="btn w-full bg-white text-black hover:bg-zinc-200 border-none py-3" onClick={doLogin}>
                  Sign In
                </button>
              </div>
              <div className="sep my-6" />
              <div className="text-xs text-zinc-500 leading-relaxed text-center">
                Cookie is <span className="font-mono">Secure</span> + <span className="font-mono">HttpOnly</span>.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar />

      <Modal open={addOpen} title="Add Domain" onClose={() => setAddOpen(false)}>
        <div className="flex bg-black/20 p-1 rounded-lg mb-4">
          <button 
            onClick={() => setBulkMode(false)}
            className={`flex-1 py-1.5 text-xs rounded-md transition ${!bulkMode ? 'bg-white/10 shadow-sm' : 'text-zinc-500'}`}
          >
            Single
          </button>
          <button 
            onClick={() => setBulkMode(true)}
            className={`flex-1 py-1.5 text-xs rounded-md transition ${bulkMode ? 'bg-white/10 shadow-sm' : 'text-zinc-500'}`}
          >
            Bulk
          </button>
        </div>

        {bulkMode ? (
          <form onSubmit={handleBulkAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 text-xs uppercase tracking-wider">Domains (one per line)</label>
              <textarea 
                className="input min-h-[150px] resize-none text-sm" 
                placeholder="google.com&#10;apple.com, example.net"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 text-xs uppercase tracking-wider">Interval (min)</label>
              <input type="number" className="input" value={newInterval} onChange={e => setNewInterval(Number(e.target.value))} />
            </div>
            <button type="submit" className="btn w-full bg-white text-black hover:bg-zinc-200 border-none py-3 font-bold">
              Import List
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 text-xs uppercase tracking-wider">Domain Name</label>
              <input type="text" className="input" placeholder="example.com" value={newDomain} onChange={e => setNewDomain(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 text-xs uppercase tracking-wider">Label (Optional)</label>
              <input type="text" className="input" placeholder="Client X" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 text-xs uppercase tracking-wider">Interval (min)</label>
              <input type="number" className="input" value={newInterval} onChange={e => setNewInterval(Number(e.target.value))} />
            </div>
            <button type="submit" className="btn w-full bg-white text-black hover:bg-zinc-200 border-none py-3 font-bold">
              Start Monitoring
            </button>
          </form>
        )}
      </Modal>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {tab === "dashboard" && (
          <>
            <div className="grid md:grid-cols-5 gap-4">
              <div className="card p-4">
                <div className="text-zinc-400 text-xs">Total</div>
                <div className="text-2xl font-semibold mt-1">{stats.total}</div>
              </div>
              <div className="card p-4">
                <div className="text-zinc-400 text-xs">Enabled</div>
                <div className="text-2xl font-semibold mt-1">{stats.enabled}</div>
              </div>
              <div className="card p-4">
                <div className="text-zinc-400 text-xs">Available</div>
                <div className="text-2xl font-semibold mt-1">{stats.available}</div>
              </div>
              <div className="card p-4">
                <div className="text-zinc-400 text-xs">Rate‑limited</div>
                <div className="text-2xl font-semibold mt-1">{stats.rateLimited}</div>
              </div>
              <div className="card p-4">
                <div className="text-zinc-400 text-xs">Errors</div>
                <div className="text-2xl font-semibold mt-1">{stats.errors}</div>
              </div>
            </div>

            <div className="mt-6 card overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">Domains</div>
                  <div className="text-xs text-zinc-400">Auto‑refresh every 30s</div>
                </div>
                <div className="text-xs text-zinc-500">Now: {new Date(now*1000).toLocaleString()}</div>
              </div>
              <div className="sep" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-zinc-400">
                    <tr className="text-left">
                      <th className="px-4 py-3">Domain</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Next</th>
                      <th className="px-4 py-3">Interval</th>
                      <th className="px-4 py-3 text-emerald-400">Expires</th>
                      <th className="px-4 py-3">Last Check</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map(d => (
                      <tr key={d.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{d.domain}</div>
                          <div className="text-xs text-zinc-500">{d.label || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={classNames(statusPill(d.last_status))}>
                            <span className="text-[10px]">●</span>
                            {(d.last_status || "unknown").replace("_"," ")}
                          </div>
                          {d.last_rdap_http ? <div className="text-xs text-zinc-500 mt-1 pl-4">HTTP {d.last_rdap_http}</div> : null}
                          {d.last_error ? <div className="text-xs text-rose-200/80 mt-1 max-w-xs truncate" title={d.last_error}>{d.last_error}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{relEta(d.next_check_at, now)}</div>
                          <div className="text-xs text-zinc-500">{fmtTime(d.next_check_at)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="input bg-black/30"
                            value={d.check_interval_min}
                            onChange={(e)=>setIntervalMin(d, parseInt(e.target.value,10))}
                          >
                            {[30,60,120,240,360,720,1440].map(m => (
                              <option key={m} value={m}>{m} min</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {d.expires_at ? (
                            <div className={classNames(
                              "font-medium",
                              (d.expires_at - now < 86400 * 30) ? "text-rose-400" : "text-emerald-400"
                            )}>
                              {fmtTime(d.expires_at).split(",")[0]}
                              <div className="text-[10px] opacity-70">
                                {Math.ceil((d.expires_at - now) / 86400)} days left
                              </div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-zinc-200">{fmtTime(d.last_checked_at)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button className="btn" onClick={() => toggleDomain(d)}>
                              {d.enabled === 1 ? "Disable" : "Enable"}
                            </button>
                            <button className="btn" onClick={() => forceCheck(d)}>Force</button>
                            <button className="btn" onClick={() => removeDomain(d)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {domains.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-zinc-400" colSpan={7}>
                          No domains yet. Click <span className="font-semibold text-zinc-200">+ Add</span> to start monitoring.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Removed Latest Activity and moved Ops Notes to About tab */}
          </>
        )}

        {tab === "activity" && (
          <div className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Activity timeline</div>
                <div className="text-xs text-zinc-400">Audit log for checks, status changes, auth events</div>
              </div>
              <button className="btn" onClick={() => {
                const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "events.json";
                a.click();
                URL.revokeObjectURL(url);
              }}>Export JSON</button>
            </div>
            <div className="sep my-4" />
            <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-3">
                  <div className={classNames(eventPill(ev.type))}>
                    <span className="text-[8px]">●</span>
                    {ev.type}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{ev.message}</div>
                    <div className="text-xs text-zinc-500">{fmtTime(ev.created_at)}</div>
                  </div>
                </div>
              ))}
              {events.length === 0 && <div className="text-zinc-400">No activity yet.</div>}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <div className="text-xl font-semibold">Infrastructure</div>
              <div className="text-zinc-400 text-sm mt-1">Core system architecture</div>
              <div className="sep my-5" />
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Database</span>
                  <span className="font-mono text-zinc-200">Cloudflare D1 (SQLite)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Backend</span>
                  <span className="font-mono text-zinc-200">Worker (Vite/TS)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">API Endpoint</span>
                  <span className="font-mono text-sky-400">api.gnn.tr</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Check Interval</span>
                  <span className="font-mono text-zinc-200">Adaptive (min. 15m)</span>
                </div>
              </div>
              
              <div className="sep my-6" />
              <div className="text-xl font-semibold">Operational Notes</div>
              <ul className="text-sm text-zinc-300 space-y-3 mt-4 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-zinc-500">•</span>
                  <span>Default checks are hourly. Adaptive backoff applies on rate limits (6h → 12h → 24h).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-zinc-500">•</span>
                  <span>Errors automatically trigger a 2h backoff to prevent system spam.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-zinc-500">•</span>
                  <span>System is designed to stay within Cloudflare Always-Free tier limits.</span>
                </li>
              </ul>
            </div>

            <div className="card p-6 bg-grid">
              <div className="text-xl font-semibold">System Utilities</div>
              <div className="text-zinc-400 text-sm mt-1">Notifications & maintenance</div>
              
              <div className="sep my-5" />
              <div className="text-sm font-medium text-zinc-300 mb-3 uppercase tracking-wider">Test Notification</div>
              <button className="btn w-full py-3 bg-white/5 hover:bg-white/10 border-white/10" onClick={async () => {
                try {
                  await api.testNotify();
                  toast.push("Test notification sent!");
                } catch (e: any) {
                  toast.push(e.message || "Failed to send");
                }
              }}>
                🔔 Send Test Notification
              </button>

              <div className="sep my-8" />
              <div className="text-sm font-medium text-rose-400 mb-3 uppercase tracking-wider">Database Maintenance</div>
              
              <div className="space-y-3">
                <button className="btn w-full py-2.5 text-sm bg-white/5 hover:bg-white/10 border-white/5" onClick={async () => {
                  try {
                    const res = await api.cleanEvents();
                    toast.push(`Cleaned ${res.removed} old events.`);
                    await refreshAll();
                  } catch (e: any) {
                    toast.push(e.message);
                  }
                }}>
                  🧹 Clean Events (&gt; 30 days)
                </button>

                <button className="btn w-full py-2.5 text-sm bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-300" onClick={async () => {
                  if (!confirm("⚠️ FACTORY RESET: This will delete ALL domains, ALL events, and reset ID counters. Are you absolutely sure?")) return;
                  try {
                    await api.factoryReset();
                    toast.push("System reset complete.");
                    window.location.reload();
                  } catch (e: any) {
                    toast.push(e.message);
                  }
                }}>
                  💀 Factory Reset System
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal open={addOpen} title="Add Domain" onClose={() => setAddOpen(false)}>
        <div className="flex bg-black/20 p-1 rounded-lg mb-4">
          <button 
            onClick={() => setBulkMode(false)}
            className={`flex-1 py-1.5 text-xs rounded-md transition ${!bulkMode ? 'bg-white/10 shadow-sm' : 'text-zinc-500'}`}
          >
            Single
          </button>
          <button 
            onClick={() => setBulkMode(true)}
            className={`flex-1 py-1.5 text-xs rounded-md transition ${bulkMode ? 'bg-white/10 shadow-sm' : 'text-zinc-500'}`}
          >
            Bulk
          </button>
        </div>

        {bulkMode ? (
          <form onSubmit={handleBulkAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Domains (one per line or comma separated)</label>
              <textarea 
                className="input min-h-[150px] resize-none" 
                placeholder="google.com&#10;apple.com, example.net"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Interval (min)</label>
              <input type="number" className="input" value={newInterval} onChange={e => setNewInterval(Number(e.target.value))} />
            </div>
            <button type="submit" className="btn w-full bg-white text-black hover:bg-zinc-200 border-none py-3">
              Import All
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Domain Name</label>
              <input type="text" className="input" placeholder="example.com" value={newDomain} onChange={e => setNewDomain(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Label (Optional)</label>
              <input type="text" className="input" placeholder="Client X" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Interval (min)</label>
              <input type="number" className="input" value={newInterval} onChange={e => setNewInterval(Number(e.target.value))} />
            </div>
            <button type="submit" className="btn w-full bg-white text-black hover:bg-zinc-200 border-none py-3">
              Start Monitoring
            </button>
          </form>
        )}
      </Modal>

      <footer className="py-10 text-center text-xs text-zinc-500 flex flex-col items-center gap-3">
		  <div>Backorder • built for always-free operations</div>

		  <a
			href="https://github.com/BigDesigner/Backorder-Always-Free-Domain-Monitor"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="GitHub Repository"
			className="opacity-80 hover:opacity-100 transition"
		  >
			<svg
			  xmlns="http://www.w3.org/2000/svg"
			  viewBox="0 0 24 24"
			  className="w-6 h-6 fill-white"
			>
			  <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.1 3.29 9.42 7.86 10.96.58.1.79-.25.79-.56v-2.02c-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.29-1.71-1.29-1.71-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.74-1.56-2.56-.29-5.26-1.28-5.26-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.27 5.69.42.36.79 1.07.79 2.16v3.2c0 .31.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/>
			</svg>
		  </a>
	  </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

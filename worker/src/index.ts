import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { ensureAdmin, addEvent, listDomains, listEvents, nowSec, getDomainById, getDomainByName } from "./db";
import { requireAuth, login as doLogin, logout as doLogout, getSessionTokenFromRequest } from "./auth";
import { runScheduler } from "./scheduler";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return null;
    if (origin.endsWith("gnn.tr") || origin.endsWith("pages.dev")) return origin;
    return null;
  },
  credentials: true
}));

app.get("/api/health", async (c) => {
  await ensureAdmin(c.env);
  return c.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/api/me", async (c) => {
  await ensureAdmin(c.env);
  const user = await requireAuth(c.env, c.req.raw);
  if (!user) return c.json({ ok: false }, 401);
  return c.json({ ok: true, user });
});

app.post("/api/login", async (c) => {
  await ensureAdmin(c.env);
  const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) return c.json({ ok: false, error: "Missing email/password" }, 400);

  const res = await doLogin(c.env, body.email, body.password);
  if (!res) {
    await addEvent(c.env, null, "auth", `Failed login attempt for ${body.email}`);
    return c.json({ ok: false, error: "Invalid credentials" }, 401);
  }

  await addEvent(c.env, null, "auth", `Login success for ${body.email}`);
  // Cookie for browser usage
  c.header(
  "Set-Cookie",
  `bo_session=${encodeURIComponent(res.token)}; Path=/; Max-Age=${60*60*24*7}; HttpOnly; SameSite=None; Secure`
);

  return c.json({ ok: true, token: res.token });
});

app.post("/api/logout", async (c) => {
  await ensureAdmin(c.env);
  const token = getSessionTokenFromRequest(c.req.raw);
  if (token) await doLogout(c.env, token);
  c.header("Set-Cookie", "bo_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  return c.json({ ok: true });
});

app.get("/api/domains", async (c) => {
  await ensureAdmin(c.env);
  const user = await requireAuth(c.env, c.req.raw);
  if (!user) return c.json({ ok: false }, 401);

  const domains = await listDomains(c.env);
  return c.json({ ok: true, domains, now: nowSec() });
});

app.post("/api/domains", async (c) => {
  await ensureAdmin(c.env);
  const user = await requireAuth(c.env, c.req.raw);
  if (!user) return c.json({ ok: false }, 401);

  const body = await c.req.json().catch(() => null) as { domain?: string; label?: string; intervalMin?: number } | null;
  const domain = (body?.domain || "").trim().toLowerCase();
  if (!domain || !domain.includes(".")) return c.json({ ok: false, error: "Invalid domain" }, 400);

  const existing = await getDomainByName(c.env, domain);
  if (existing) return c.json({ ok: false, error: "Domain already exists" }, 409);

  const intervalMin = Math.max(30, Math.min(24*60, Math.floor(body?.intervalMin ?? 60)));
  const now = nowSec();
  // Set next_check_at to NOW so it gets picked up immediately
  const next = now;

  await c.env.DB.prepare(
    "INSERT INTO domains(domain, label, enabled, check_interval_min, next_check_at, last_checked_at, last_status, created_at) VALUES(?,?,?,?,?,?,?,?)"
  ).bind(domain, body?.label ?? null, 1, intervalMin, next, null, "unknown", now).run();

  const row = await getDomainByName(c.env, domain);
  if (row) {
    await addEvent(c.env, row.id, "info", `Domain added by ${user.email}: ${domain} (interval ${intervalMin}m)`);
    // Run scheduler immediately after add
    await runScheduler(c.env);
  }
  return c.json({ ok: true, domain: row });
});

app.patch("/api/domains/:id", async (c) => {
  await ensureAdmin(c.env);
  const user = await requireAuth(c.env, c.req.raw);
  if (!user) return c.json({ ok: false }, 401);

  const id = Number(c.req.param("id"));
  const d = await getDomainById(c.env, id);
  if (!d) return c.json({ ok: false, error: "Not found" }, 404);

  const body = await c.req.json().catch(() => null) as { label?: string; enabled?: boolean; intervalMin?: number; forceCheck?: boolean } | null;
  const updates: string[] = [];
  const binds: unknown[] = [];

  if (typeof body?.label === "string") {
    updates.push("label = ?");
    binds.push(body.label);
  }
  if (typeof body?.enabled === "boolean") {
    updates.push("enabled = ?");
    binds.push(body.enabled ? 1 : 0);
  }
  if (typeof body?.intervalMin === "number") {
    const intervalMin = Math.max(30, Math.min(24*60, Math.floor(body.intervalMin)));
    updates.push("check_interval_min = ?");
    binds.push(intervalMin);
  }
  if (body?.forceCheck) {
    updates.push("next_check_at = ?");
    binds.push(nowSec());
  }
  binds.push(id);
  await c.env.DB.prepare(`UPDATE domains SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();

  if (body?.forceCheck) {
    // Run scheduler AFTER the database has been updated
    await runScheduler(c.env);
  }

  await addEvent(c.env, id, "info", `Domain updated by ${user.email}: ${d.domain}`);
  const d2 = await getDomainById(c.env, id);
  return c.json({ ok: true, domain: d2 });
});

app.post("/api/domains/:id/delete", async (c) => {
  await ensureAdmin(c.env);
  const user = await requireAuth(c.env, c.req.raw);
  if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);

  const idOrName = c.req.param("id");
  
  // Try to delete by ID first (as integer)
  const id = Number(idOrName);
  if (!isNaN(id)) {
    await c.env.DB.prepare("DELETE FROM events WHERE domain_id = CAST(? AS INTEGER)").bind(id).run();
    const res = await c.env.DB.prepare("DELETE FROM domains WHERE id = CAST(? AS INTEGER)").bind(id).run();
    if (res.meta.changes > 0) {
      await addEvent(c.env, null, "info", `Domain (ID: ${id}) purged by ${user.email}`);
      return c.json({ ok: true });
    }
  }

  // Fallback: Try to delete by domain name (as string)
  // This is a safety net if IDs are acting weird after migrations
  const res2 = await c.env.DB.prepare("DELETE FROM domains WHERE domain = ?").bind(idOrName).run();
  if (res2.meta.changes > 0) {
     await addEvent(c.env, null, "info", `Domain (${idOrName}) purged by name by ${user.email}`);
     return c.json({ ok: true });
  }

  return c.json({ ok: false, error: "Domain not found or already deleted" }, 404);
});

app.get("/api/events", async (c) => {
  await ensureAdmin(c.env);
  const user = await requireAuth(c.env, c.req.raw);
  if (!user) return c.json({ ok: false }, 401);

  const limit = Math.max(50, Math.min(500, Number(c.req.query("limit") || 200)));
  const events = await listEvents(c.env, limit);
  return c.json({ ok: true, events });
});

app.post("/api/test-notify", async (c) => {
  await ensureAdmin(c.env);
  const user = await requireAuth(c.env, c.req.raw);
  if (!user) return c.json({ ok: false }, 401);

  const { notifyAll } = await import("./notify");
  await notifyAll(c.env, `🔔 Backorder Test: This is a manual notification test from ${user.email}. System is ready!`);
  return c.json({ ok: true });
});

// Cron trigger
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await ensureAdmin(env);
      const res = await runScheduler(env);
      await addEvent(env, null, "info", `Scheduler tick: checked=${res.checked} due=${res.due}`);
    })());
  }
};

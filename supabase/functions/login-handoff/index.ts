// Slideshot: Slack sign-in handoff for the PowerPoint add-in (panel.html + auth-slack.html).
// PowerPoint for Mac's embedded dialog is refused by Slack, so the add-in opens the system browser instead.
// The browser signs in and parks the session here under a one-time code that only the add-in knows;
// the add-in polls and takes it once. Only this function reads or writes public.login_handoffs.
//
// POST { action, code, ... }
//   start  {code}                              add-in: register a new code (valid 5 minutes)
//   store  {code, access_token, refresh_token} browser: park the session (token is checked first)
//   fail   {code, error}                       browser: Slack/Supabase refused the sign-in
//   take   {code}                              add-in: returns the session (or error) and deletes the row
//   cancel {code}                              add-in: the user cancelled
// Deploy with JWT verification OFF (the project uses a publishable key, which is not a JWT).
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const TABLE = "login_handoffs";
const TTL_MS = 5 * 60 * 1000;
const CODE = /^[A-Za-z0-9_-]{32,128}$/;
const ORIGINS = ["https://ridhoofrahman.github.io"];

function corsHeaders(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  const allow = ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o) ? o : ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ status: "error", error: "method not allowed" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply({ status: "error", error: "bad request" }, 400); }
  const code = String(b.code || "");
  if (!CODE.test(code)) return reply({ status: "error", error: "bad code" }, 400);
  const now = new Date().toISOString();

  switch (b.action) {
    case "start": {
      await admin.from(TABLE).delete().lt("expires_at", now);   // housekeeping: drop expired rows
      const { error } = await admin.from(TABLE).insert({ code, expires_at: new Date(Date.now() + TTL_MS).toISOString() });
      return error ? reply({ status: "error", error: "start failed" }, 409) : reply({ status: "started" });
    }
    case "store": {
      const at = String(b.access_token || ""), rt = String(b.refresh_token || "");
      if (!at || !rt) return reply({ status: "error", error: "missing tokens" }, 400);
      const { data: u, error: ue } = await admin.auth.getUser(at);   // only real Slideshot sessions
      if (ue || !u?.user) return reply({ status: "error", error: "invalid session" }, 401);
      const { data, error } = await admin.from(TABLE).update({ access_token: at, refresh_token: rt })
        .eq("code", code).is("access_token", null).is("error", null).gt("expires_at", now).select("code");
      if (error) return reply({ status: "error", error: "store failed" }, 500);
      return data.length ? reply({ status: "stored" }) : reply({ status: "expired" }, 410);
    }
    case "fail": {
      const { data, error } = await admin.from(TABLE).update({ error: String(b.error || "unknown").slice(0, 300) })
        .eq("code", code).is("access_token", null).is("error", null).gt("expires_at", now).select("code");
      if (error) return reply({ status: "error", error: "store failed" }, 500);
      return data.length ? reply({ status: "stored" }) : reply({ status: "expired" }, 410);
    }
    case "take": {
      // Read and delete in one statement: the session can be taken only once
      const { data, error } = await admin.from(TABLE).delete()
        .eq("code", code).gt("expires_at", now).or("access_token.not.is.null,error.not.is.null")
        .select("access_token,refresh_token,error");
      if (error) return reply({ status: "error", error: "take failed" }, 500);
      if (data.length) {
        const r = data[0];
        return r.error ? reply({ status: "failed", error: r.error }) : reply({ status: "ok", access_token: r.access_token, refresh_token: r.refresh_token });
      }
      const { data: p } = await admin.from(TABLE).select("code").eq("code", code).gt("expires_at", now).maybeSingle();
      return reply({ status: p ? "pending" : "expired" });
    }
    case "cancel": {
      await admin.from(TABLE).delete().eq("code", code);
      return reply({ status: "cancelled" });
    }
    default:
      return reply({ status: "error", error: "unknown action" }, 400);
  }
});

// Slideshot: sends the queued Slack notifications (spec: docs/specs/slack-notifications.md).
// Called every minute by pg_cron (sql/notifications-cron.sql) with the header x-cron-secret.
// Each run: claim the due groups (notify_claim, skip locked), build one message per group, send it as a DM
// from the Slideshot bot (chat.postMessage, channel = the recipient's Slack user id), mark the rows sent.
// Failures retry after 1, 5 and 15 minutes; after 5 attempts the rows keep last_error.
//
// Secrets: SLACK_BOT_TOKEN (xoxb-…), NOTIFY_CRON_SECRET. DRY_RUN is on unless DRY_RUN=false: messages are
// logged and stored in notification_queue.message, nothing goes to Slack.
// Deploy with JWT verification OFF (pg_cron calls it with the cron secret, not a user token).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildMessage, type Assignment, type Context, type Person, type QueueRow } from "./messages.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const SECRET = Deno.env.get("NOTIFY_CRON_SECRET") || "";
const DRY_RUN = (Deno.env.get("DRY_RUN") ?? "true").toLowerCase() !== "false";
const DASHBOARD = "https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/review.html";

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function slack(method: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch("https://slack.com/api/" + method, {
    method: "POST",
    headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json().catch(() => ({ ok: false, error: "http " + r.status }));
  if (!j.ok) throw new Error(method + ": " + (j.error || "failed"));
  return j;
}

// Slack id from the profile cache or the Slack sign-in; else look it up by email and cache it
async function slackId(p: Person | undefined): Promise<string | null> {
  if (!p) return null;
  if (p.slack_user_id) return p.slack_user_id;
  if (DRY_RUN || !TOKEN || !p.email) return null;
  try {
    const j = await slack("users.lookupByEmail", { email: p.email });
    const id = j.user?.id as string | undefined;
    if (id) { await admin.from("profiles").update({ slack_user_id: id }).eq("user_id", p.user_id); p.slack_user_id = id; }
    return id || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);
  if (!SECRET) return reply({ error: "NOTIFY_CRON_SECRET is not set" }, 500);
  if (!sameSecret(req.headers.get("x-cron-secret") || "", SECRET)) return reply({ error: "forbidden" }, 403);
  if (!DRY_RUN && !TOKEN) return reply({ error: "SLACK_BOT_TOKEN is not set" }, 500);

  const { data: claimed, error } = await admin.rpc("notify_claim", { p_groups: 100 });
  if (error) return reply({ error: "claim failed: " + error.message }, 500);
  const rows = (claimed || []) as QueueRow[];
  if (!rows.length) return reply({ groups: 0, dryRun: DRY_RUN });

  const groups = new Map<string, QueueRow[]>();
  for (const r of rows) groups.set(r.group_key, [...(groups.get(r.group_key) || []), r]);

  // Everything the messages need, in a few reads
  const ids = new Set<string>();
  for (const r of rows) { ids.add(r.recipient_id); if (r.actor_id) ids.add(r.actor_id); }
  const { data: ppl } = await admin.rpc("notify_people", { p_ids: [...ids] });
  const people = new Map<string, Person>(((ppl || []) as Person[]).map((p) => [p.user_id, p]));

  const shotIds = [...new Set(rows.filter((r) => r.event === "approved" || r.event === "changes_requested").map((r) => String(r.payload.shot_id)))];
  const shotStatus = new Map<string, string>(), openComments = new Map<string, number>();
  if (shotIds.length) {
    const { data: shots } = await admin.from("slide_shots").select("id,status").in("id", shotIds);
    for (const s of shots || []) shotStatus.set(s.id, s.status);
    const { data: cs } = await admin.from("shot_comments").select("shot_id").in("shot_id", shotIds).eq("resolved", false);
    for (const c of cs || []) openComments.set(c.shot_id, (openComments.get(c.shot_id) || 0) + 1);
  }

  const assignmentsByOrder = new Map<string, Assignment[]>();
  for (const ok of new Set(rows.filter((r) => r.event === "assignment_changed").map((r) => r.order_key))) {
    const { data: as } = await admin.from("slide_assignments").select("order_key,order_name,assignee_id,assignee_name,assignee_team,slides").ilike("order_name", "%" + ok + "%");
    assignmentsByOrder.set(ok, ((as || []) as any[]).filter((a) => String(a.order_name || a.order_key).replace(/\D/g, "") === ok));
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const [key, g] of groups) {
    const groupIds = g.map((r) => r.id);
    try {
      const ctx: Context = { people, shotStatus, openComments, assignments: assignmentsByOrder.get(g[0].order_key) || [], dashboardUrl: DASHBOARD };
      const msg = buildMessage(g, ctx);
      if (!msg) { await admin.rpc("notify_done", { p_ids: groupIds, p_message: null }); skipped++; continue; }
      if (DRY_RUN) {
        console.log("[dry-run]", key.split("|").slice(1, 3).join(" "), "→", g[0].recipient_id, ":", msg.text, msg.url ? "[Open in Slideshot] " + msg.url : "");
        await admin.rpc("notify_done", { p_ids: groupIds, p_message: "[dry-run] " + msg.text });
        sent++; continue;
      }
      const channel = await slackId(people.get(g[0].recipient_id));
      if (!channel) throw new Error("no Slack user for this account");
      const esc = msg.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");   // names are plain text, not Slack markup
      const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: esc } }];
      if (msg.url) blocks.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open in Slideshot" }, url: msg.url }] });
      await slack("chat.postMessage", { channel, text: esc, blocks, unfurl_links: false, unfurl_media: false });
      await admin.rpc("notify_done", { p_ids: groupIds, p_message: msg.text });
      sent++;
    } catch (e) {
      failed++;
      await admin.rpc("notify_failed", { p_ids: groupIds, p_error: String((e as Error)?.message || e) });
    }
  }
  return reply({ groups: groups.size, sent, skipped, failed, dryRun: DRY_RUN });
});

// Slideshot: upload a compiled order's final .pptx to the company Shared Drive (phase 3 of compile).
// The Google credentials never leave this function: it signs in as the Slideshot service account, prepares the
// folders and hands the caller a one-time resumable upload URL for exactly one file. The caller (a DM, signed in to
// Slideshot) sends the bytes straight to Google, then asks this function to share the file and return its link.
//
// Folder layout: <parent>/<order>/<stage>/<order>_<name>_<stage>.pptx   e.g. 351164/First Draft/351164_Kingfish IS_First Draft.pptx
// Uploading again to the same stage replaces the file's content (same file, same link).
// Link: "Anyone at 24Slides with the link" (domain reader, not discoverable), as a Drive preview link (…/file/d/<id>/view).
//
// POST (Authorization: Bearer <the DM's Slideshot access token>) { action, ... }
//   check                                   is everything set up? returns the Shared Drive's name
//   start  {order, stage, name, size}       returns {uploadUrl, fileName, path, replacing}
//   finish {fileId, order, stage, name}     shares the file, records it in public.deliveries, returns {link, name}
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_SA_KEY     the whole service-account JSON key (paste it as is)
//   DRIVE_ID          the Shared Drive's ID
//   DRIVE_PARENT_ID   optional: the folder that holds the order folders (default: the Shared Drive's root)
//   DRIVE_DOMAIN      optional: default 24slides.com
// Deploy with JWT verification OFF (the project uses a publishable key); the caller is checked here instead.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const DRIVE_ID = Deno.env.get("DRIVE_ID") || "";
const PARENT_ID = Deno.env.get("DRIVE_PARENT_ID") || DRIVE_ID;
const DOMAIN = Deno.env.get("DRIVE_DOMAIN") || "24slides.com";
const ORIGINS = ["https://ridhoofrahman.github.io"];
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const FOLDER = "application/vnd.google-apps.folder";
const API = "https://www.googleapis.com/drive/v3";
const ALL = "supportsAllDrives=true";

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

// ---- Google access token for the service account (JWT bearer grant), cached until shortly before it expires
let cached: { token: string; until: number } | null = null;
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; bytes.forEach((x) => { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function googleToken(): Promise<string> {
  if (cached && Date.now() < cached.until) return cached.token;
  const raw = Deno.env.get("GOOGLE_SA_KEY");
  if (!raw) throw new Error("GOOGLE_SA_KEY is not set");
  const key = JSON.parse(raw);
  const pem = String(key.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: key.client_email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k, new TextEncoder().encode(head + "." + body)));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + body + "." + sig }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Google sign-in failed: " + (j.error_description || j.error || r.status));
  cached = { token: j.access_token, until: Date.now() + (j.expires_in - 120) * 1000 };
  return cached.token;
}
async function drive(path: string, init: RequestInit = {}) {
  const t = await googleToken();
  const r = await fetch(path.startsWith("http") ? path : API + path, { ...init, headers: { Authorization: "Bearer " + t, ...(init.headers || {}) } });
  if (!r.ok) throw new Error("Drive " + r.status + ": " + (await r.text()).slice(0, 300));
  return r;
}
const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
async function findOne(name: string, parent: string, mime?: string) {
  const query = `name = '${q(name)}' and '${parent}' in parents and trashed = false` + (mime ? ` and mimeType = '${mime}'` : "");
  const r = await drive(`/files?${ALL}&includeItemsFromAllDrives=true&corpora=drive&driveId=${DRIVE_ID}&fields=files(id,name)&q=${encodeURIComponent(query)}`);
  return ((await r.json()).files || [])[0] || null;
}
async function folder(name: string, parent: string): Promise<string> {
  const f = await findOne(name, parent, FOLDER);
  if (f) return f.id;
  const r = await drive(`/files?${ALL}&fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }) });
  return (await r.json()).id;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);

  // Only signed-in Design Managers
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await admin.auth.getUser(jwt);
  if (ue || !u?.user) return reply({ error: "Sign in to Slideshot first." }, 401);
  const dm = await admin.from("design_managers").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!dm.data) return reply({ error: "Only a DM can upload final files." }, 403);
  if (!DRIVE_ID) return reply({ error: "DRIVE_ID is not set" }, 500);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply({ error: "bad request" }, 400); }
  try {
    switch (b.action) {
      case "check": {
        const r = await drive(`/drives/${DRIVE_ID}?fields=id,name`);
        const d = await r.json();
        let parent = "the Shared Drive root";
        if (PARENT_ID !== DRIVE_ID) { const p = await (await drive(`/files/${PARENT_ID}?${ALL}&fields=id,name,driveId`)).json(); if (p.driveId !== DRIVE_ID) throw new Error("DRIVE_PARENT_ID is not in that Shared Drive"); parent = p.name; }
        return reply({ ok: true, drive: d.name, parent });
      }
      case "start": {
        const order = String(b.order || ""), stage = String(b.stage || ""), name = String(b.name || "").trim(), size = Number(b.size || 0);
        if (!/^\d{3,9}$/.test(order)) return reply({ error: "Order number should be digits only." }, 400);
        if (!/^(First Draft|Revision \d{1,2})$/.test(stage)) return reply({ error: "Stage should be First Draft or Revision N." }, 400);
        if (!name || name.length > 120 || /[\\/:*?"<>|]/.test(name)) return reply({ error: "File name can't be empty or contain \\ / : * ? \" < > |" }, 400);
        if (!(size > 0)) return reply({ error: "Missing file size." }, 400);
        const fileName = `${order}_${name}_${stage}.pptx`;
        const stageId = await folder(stage, await folder(order, PARENT_ID));
        const existing = await findOne(fileName, stageId);
        // Resumable session; the browser's Origin is passed on so Google allows the upload from the add-in (CORS)
        const origin = req.headers.get("origin") || ORIGINS[0];
        const init = existing
          ? drive(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=resumable&${ALL}&fields=id,name`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": PPTX, "X-Upload-Content-Length": String(size), Origin: origin }, body: "{}" })
          : drive(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&${ALL}&fields=id,name`, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": PPTX, "X-Upload-Content-Length": String(size), Origin: origin }, body: JSON.stringify({ name: fileName, parents: [stageId], mimeType: PPTX }) });
        const r = await init;
        const uploadUrl = r.headers.get("location");
        if (!uploadUrl) throw new Error("Drive didn't return an upload URL");
        return reply({ uploadUrl, fileName, path: `${order}/${stage}/${fileName}`, replacing: !!existing });
      }
      case "finish": {
        const id = String(b.fileId || "");
        if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return reply({ error: "bad file id" }, 400);
        const f = await (await drive(`/files/${id}?${ALL}&fields=id,name,driveId,size`)).json();
        if (f.driveId !== DRIVE_ID) return reply({ error: "That file isn't in the Slideshot Shared Drive." }, 403);
        await drive(`/files/${id}/permissions?${ALL}`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "domain", domain: DOMAIN, role: "reader", allowFileDiscovery: false }) });
        const link = `https://drive.google.com/file/d/${id}/view`;
        // Record it (one row per order + stage; uploading the same stage again updates the row). The test page sends no order.
        const order = String(b.order || ""), stage = String(b.stage || ""), name = String(b.name || "").trim();
        if (/^\d{3,9}$/.test(order) && /^(First Draft|Revision \d{1,2})$/.test(stage) && name) {
          const meta = (u.user.user_metadata || {}) as Record<string, unknown>;
          const { error } = await admin.from("deliveries").upsert({ order_key: order, stage, name, file_name: f.name, file_id: id, link,
            size_bytes: Number(f.size) || null, uploaded_by: u.user.id, uploaded_by_name: String(meta.name || u.user.email || ""), uploaded_at: new Date().toISOString() },
            { onConflict: "order_key,stage" });
          if (error) console.error("drive-upload: deliveries not recorded:", error);
        }
        return reply({ link, name: f.name });
      }
      default: return reply({ error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error("drive-upload:", e);
    return reply({ error: String((e as Error).message || e) }, 502);
  }
});

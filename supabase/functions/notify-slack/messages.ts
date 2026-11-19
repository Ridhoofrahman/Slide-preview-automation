// Slack message text for one group of queued events (pure functions, no I/O; tested with dev/notify-test.mjs).
// Privacy: order number, slide numbers, counts, people's names and a link only. Never slide images,
// comment text, customer or file names.

export type QueueRow = {
  id: number; event: string; recipient_id: string; actor_id: string | null; actor_name: string | null;
  order_key: string; payload: Record<string, any>; group_key: string;
};
export type Person = { user_id: string; name: string | null; team: string | null; slack_user_id: string | null; email: string | null };
export type Assignment = { assignee_id: string; assignee_name: string; assignee_team: string | null; slides: number[] };
export type Context = {
  people: Map<string, Person>;
  shotStatus: Map<string, string>;     // shot id → current status (missing = deleted)
  openComments: Map<string, number>;   // shot id → unresolved comments
  assignments: Assignment[];           // current distribution of the group's order
  dashboardUrl: string;
};
export type Message = { text: string; url?: string };

const uniq = (nums: number[]) => [...new Set(nums.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);

// Same format as the panel's rangesText(): runs of 2+ become "9–10"
export function ranges(nums: number[]): string[] {
  const s = uniq(nums), out: string[] = [];
  for (let i = 0; i < s.length;) {
    let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? String(s[i]) : s[i] + "–" + s[j]); i = j + 1;
  }
  return out;
}
export const joinAnd = (parts: string[]) => parts.length < 2 ? (parts[0] || "") : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
export const listText = (nums: number[]) => joinAnd(ranges(nums));
export const slidesText = (nums: number[]) => (uniq(nums).length === 1 ? "slide " : "slides ") + listText(nums);
const plural = (n: number, w: string) => n + " " + w + (n === 1 ? "" : "s");
// "slides 2 and 4", "an alternative of slide 1", "slides 2 and 4 and alternatives of slides 1 and 3"
const isAlt = (r: QueueRow) => Number(r.payload.alternative_of) > 0;
function slidesAndAlts(rows: QueueRow[]): string {
  const main = uniq(rows.filter((r) => !isAlt(r)).map((r) => Number(r.payload.slide_number)));
  const alts = rows.filter(isAlt).map((r) => Number(r.payload.alternative_of));
  const parts: string[] = [];
  if (main.length) parts.push(slidesText(main));
  if (alts.length) parts.push(alts.length === 1 ? "an alternative of slide " + alts[0] : "alternatives of " + slidesText(alts));
  return parts.join(" and ");
}

function who(ctx: Context, id: string | null, fallback: string | null, withTeam: boolean): string {
  const p = id ? ctx.people.get(id) : undefined;
  const name = (p?.name || fallback || "").trim() || "Someone";
  return withTeam && p?.team ? name + "_" + p.team : name;
}
const actors = (rows: QueueRow[], ctx: Context) =>
  joinAnd([...new Set(rows.map((r) => who(ctx, r.actor_id, r.actor_name || r.payload.reviewer, false)))]);

export function buildMessage(rows: QueueRow[], ctx: Context): Message | null {
  if (!rows.length) return null;
  const rs = [...rows].sort((a, b) => a.id - b.id), first = rs[0], last = rs[rs.length - 1];
  const order = "#" + first.order_key;
  const link = (nums: number[]) => ctx.dashboardUrl + "?order=" + encodeURIComponent(first.order_key) + (nums.length ? "&slide=" + uniq(nums)[0] : "");

  switch (first.event) {
    case "slide_sent":
    case "slide_revised": {
      const nums = uniq(rs.map((r) => Number(r.payload.slide_number)));
      if (!nums.length) return null;
      const p = last.payload;
      const designer = (p.designer || "A designer") + (p.team ? "_" + p.team : "");
      const main = uniq(rs.filter((r) => !isAlt(r)).map((r) => Number(r.payload.slide_number)));
      const alts = rs.filter(isAlt);
      if (first.event === "slide_sent") {
        if (!main.length) return { text: `${designer} sent ${slidesAndAlts(alts)} for review in ${order}.`, url: link(nums) + "&alt=1" };
        const extra = alts.length ? `, plus ${slidesAndAlts(alts)}` : "";
        return { text: `${designer} sent ${plural(main.length, "slide")} for review in ${order} (${slidesText(main)}${extra}).`, url: link(main) };
      }
      const afterFeedback = rs.every((r) => r.payload.prev_status === "changes");
      return { text: `${designer} sent new versions of ${slidesAndAlts(rs)} in ${order}${afterFeedback ? " after your feedback" : ""}.`, url: link(nums) };
    }
    case "changes_requested":
    case "approved": {
      const want = first.event === "approved" ? "approved" : "changes";
      const still = rs.filter((r) => ctx.shotStatus.get(String(r.payload.shot_id)) === want);   // decision undone meanwhile → drop
      const nums = uniq(still.map((r) => Number(r.payload.slide_number)));
      if (!nums.length) return null;
      const by = actors(still, ctx);
      if (want === "approved") return { text: `${by} approved ${slidesAndAlts(still)} in ${order}.` };
      const comments = [...new Set(still.map((r) => String(r.payload.shot_id)))].reduce((n, id) => n + (ctx.openComments.get(id) || 0), 0);
      const it = still.length === 1 ? "it" : "them";
      return { text: `${by} requested changes on ${slidesAndAlts(still)} in ${order}${comments ? " (" + plural(comments, "comment") + ")" : ""}. Open the deck, fix ${it} and upload the latest version.` };
    }
    case "assignment_changed": {
      const before = uniq((first.payload.before || []).map(Number)), after = uniq((last.payload.after || []).map(Number));
      if (before.join() === after.join()) return null;                               // deleted and saved again unchanged
      // Order deleted (its whole distribution is gone): say nothing. The assign dialog always keeps at least one row.
      if (!after.length) return ctx.assignments.length ? { text: `You no longer have slides in ${order}.` } : null;
      if (!before.length) {
        const by = who(ctx, last.actor_id, last.actor_name, false);
        return { text: `${by} assigned you ${slidesText(after)} in ${order}. Open the deck in PowerPoint and type ${order} in Slideshot.` };
      }
      let text = `Your slides in ${order} changed: you now have ${listText(after)}.`;
      const gone = before.filter((n) => !after.includes(n));
      const byHolder = new Map<string, number[]>();
      for (const n of gone) {
        const a = ctx.assignments.find((x) => x.assignee_id !== first.recipient_id && (x.slides || []).includes(n));
        const k = a ? a.assignee_name : "";   // first name only, as agreed
        byHolder.set(k, [...(byHolder.get(k) || []), n]);
      }
      for (const [holder, nums] of byHolder) {
        const s = slidesText(nums), cap = s[0].toUpperCase() + s.slice(1), verb = nums.length === 1 ? "is" : "are";
        text += holder ? ` ${cap} moved to ${holder}.` : ` ${cap} ${verb} no longer assigned.`;
      }
      return { text };
    }
  }
  return null;
}

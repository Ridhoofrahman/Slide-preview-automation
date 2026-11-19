# Slack notifications, v1 spec

Agreed with Uda on 19 Nov 2026. Save as `docs/specs/slack-notifications.md`, then build it step by step. Show the plan and the SQL before running anything on the live project.

## Decisions
- Channel: **Slack direct messages from a Slideshot bot.** No email, no in-app inbox in v1.
- Messages are **batched** per recipient and order:
  - slides sent and new versions: **3 min**
  - changes requested and approvals: **5 min**
  - assignment changes: **1 min** (agreed 19 Nov 2026; the assign dialog saves several rows at once)
- Deleting an order notifies nobody (agreed 19 Nov 2026). "moved to …" names the other designer by name only ("Kevin").
- Out-of-hours: rely on Slack's own Do Not Disturb. No shift logic in v1.
- **Privacy:** no slide images, no comment text, no customer or file names in Slack. Use the order number only (`#351164`), slide numbers, counts and a link.
- Nobody is notified about their own action (actor = recipient → skip).

## v1 events
| Key | Source | Condition | Recipient | Window |
|---|---|---|---|---|
| `slide_sent` | `slide_shots` INSERT | `version = 1` | every DM whose `profiles.team = new.team` (`design_managers` join `profiles`) | 3 min |
| `slide_revised` | `slide_shots` INSERT | `version > 1` | same as above | 3 min |
| `assignment_changed` | `slide_assignments` INSERT / UPDATE / DELETE | slides added, removed or the row deleted | `assignee_id` (old and new assignee on UPDATE) | 1 min |
| `changes_requested` | `slide_shots` UPDATE | `status` changed to `changes` | `designer_id` | 5 min |
| `approved` | `slide_shots` UPDATE | `status` changed to `approved` | `designer_id` | 5 min |

Tag team orders: a DM is only told about slides of their own team (`slide_shots.team`). The actor is `auth.uid()` inside the trigger (the request's user).

v2 backlog: all of a designer's slides are in (DM), review waiting longer than 2 h (DM reminder), comment without a decision (designer), decision reverted, order sent to customer.

## Data model
`public.notification_queue`:
- `id bigserial primary key`
- `created_at timestamptz default now()`
- `event text`
- `recipient_id uuid`
- `actor_id uuid`, `actor_name text`
- `order_key text` (digits only, from `orderId()`)
- `payload jsonb`: slide_number, version, designer name and team, assignment before and after
- `group_key text`: `recipient|order|event`, plus the designer for DM events
- `send_after timestamptz`: first event of the group + window, so a group never waits longer than its window
- `sent_at timestamptz`, `attempts int default 0`, `last_error text`

Rules for the table:
- RLS enabled with **no policies**. Only the service role reads or writes it; clients never touch it.
- Triggers are `security definer`. They write a row and nothing else, so a Slack outage can never block sending or reviewing a slide.
- Slack user ids are cached in `profiles.slack_user_id text`. The value comes from the Slack sign-in identity (`auth.identities` where provider is `slack_oidc`; check whether the id is in `identity_data->>'sub'` or `https://slack.com/user_id`). Fall back to `users.lookupByEmail` for people who have never signed in.

## Sender: Edge Function `notify-slack`
- Same pattern as `supabase/functions/login-handoff`: Deno, `SUPABASE_SERVICE_ROLE_KEY`. New secrets: `SLACK_BOT_TOKEN`, `NOTIFY_CRON_SECRET`.
- Runs every minute via `pg_cron` + `pg_net`, which call the function with the cron secret header.
- Each run:
  1. Claim the due groups (`send_after <= now()`, `sent_at is null`) with `for update skip locked` in an RPC, so overlapping runs never double-send.
  2. Build one message per group.
  3. Send with `chat.postMessage` (channel = the recipient's Slack user id).
  4. Mark the group sent.
- On failure: `attempts + 1` and retry later (1, 5, 15 min). Give up after 5 attempts and keep `last_error`.

## Message copy (English, like the product)
Slide lists use the panel's range format (`1–5, 7`). Recipients see `Name_Team` for people.

| Event | Text |
|---|---|
| `slide_sent` | Bela_Cascade sent 5 slides for review in #351164 (slides 1–5). |
| `slide_revised` | Bela_Cascade sent new versions of slides 2 and 4 in #351164 after your feedback. |
| `assignment_changed` (new) | Ridho assigned you slides 6–10 in #351164. Open the deck in PowerPoint and type #351164 in Slideshot. |
| `assignment_changed` (changed) | Your slides in #351164 changed: you now have 6–8. Slides 9–10 moved to Kevin. |
| `assignment_changed` (removed) | You no longer have slides in #351164. |
| `changes_requested` | Ridho requested changes on slides 2 and 4 in #351164 (3 comments). Open the deck, fix them and upload the latest version. |
| `approved` | Ridho approved slides 1, 3 and 5 in #351164. |

Notes on the copy:
- `slide_revised` says "after your feedback" only if the previous version's status was `changes`. Otherwise it reads "sent new versions of …".
- DM messages get a button **Open in Slideshot**. Designer messages get none, because designers can't open the dashboard yet.
- The comment count is read when sending: open comments on those slides.

## Dashboard deep link
- `review.html?order=351164&slide=6` opens that order and slide after sign-in.
- Use the **query string, not the hash**. The hash carries Supabase auth tokens (see `hasAuthParams`).
- Unknown order, or a non-DM account: fall back to the board.

## Slack app setup (Slack workspace admin)
1. In the existing Slideshot Slack app (the one used for sign-in), add the bot token scopes `chat:write`, `users:read` and `users:read.email`.
2. Under App Home, enable the **Messages Tab**, and set the bot's name to "Slideshot" with the app icon.
3. Reinstall the app to the workspace. The admin approves the new scopes.
4. Copy the **Bot User OAuth Token** (`xoxb-…`) into Supabase as the secret `SLACK_BOT_TOKEN`. Never commit it, and never put it in the add-in or the dashboard.

## Build order
1. SQL `sql/notifications.sql`: queue table, `profiles.slack_user_id`, triggers, claim RPC, `pg_cron` job. Keep it idempotent, like the other sql files.
2. Edge Function `notify-slack`, with a `DRY_RUN` mode that logs messages instead of sending them.
3. Dashboard deep link.
4. Test on Uda's own account. Insert or update rows on a test order and check batching, actor exclusion and tag team filtering.
5. Turn off `DRY_RUN`. Update `CLAUDE.md`, the docs page (EN + ID) and the release notes.

## Acceptance checks
- 5 slides sent within a minute produce **one** DM message listing slides 1–5.
- A DM approving their own team's slide produces nothing for themselves. The designer gets one message after 5 min.
- On a tag team order, the Trident DM is not told about Cascade slides.
- Moving slides 9–10 from Bela to Kevin tells both: Bela "changed", Kevin "assigned".
- With Slack unreachable, sending and reviewing still work. Messages go out once Slack is back.
- No message contains an image, comment text or a file or customer name.

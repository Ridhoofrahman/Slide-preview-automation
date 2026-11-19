# SQL

- **`../slide-qa-marker/supabase-setup.sql` is the full, canonical setup.** On a new Supabase project run only that file in the SQL Editor.
- The files here are the incremental scripts as they were run on the live project, kept for reference, plus one parked design:

| File | What it does | Status |
|---|---|---|
| `teams-simple.sql` | Adds `slide_shots.team` | Run (already part of the canonical file) |
| `assign-setup.sql` | `profiles` and `slide_assignments` with policies and realtime | Run (already part of the canonical file) |
| `dm-setup.sql` | `design_managers`, `is_dm()`, and DM-only policies for review, comments, delete, status and distribution | Run (already part of the canonical file). **Change the seeded email to your own before running on a new project.** |
| `teams-table.sql` | `teams` (name, office, active) seeded with the 24 teams; signed-in users read, nobody writes from the client | **To run** (already part of the canonical file) |
| `profiles-team-fk.sql` | Lists `profiles.team` values not in `teams`, then adds the foreign key | **To run after** `teams-table.sql` and cleaning the list (already part of the canonical file) |
| `login-handoffs.sql` | `login_handoffs` for the add-in's Slack sign-in through the system browser (Edge Function `login-handoff` only) | **To run** (already part of the canonical file) |
| `dm-allowlist.sql` | `dm_allowlist` (email, name, team): the 24 DMs and the team each leads; triggers keep `design_managers` and `profiles.team` in sync, also for accounts created later | **To run** after `teams-table.sql` (already part of the canonical file) |
| `signup-hook.sql` | `hook_slideshot_signup`: the Auth hook "Before User Created" that lets only @24slides.com emails sign up (first Slack sign-in creates the account) | Run (already part of the canonical file); hook enabled in Authentication → Hooks |
| `designer-allowlist.sql` | `designer_allowlist` (110 designers from Inner Platform) and `is_member()`; listed designers get their team automatically. Its last query lists accounts that would lose access | **To run** after `dm-allowlist.sql` (already part of the canonical file) |
| `members-only.sql` | Restrictive "members only" policies: only DMs and listed designers read or write data and slide files. Undo statements at the end | **To run after** checking the last query of `designer-allowlist.sql` (already part of the canonical file) |
| `notifications.sql` | Slack notifications: `notification_queue` (RLS, no policies), `profiles.slack_user_id`, triggers on `slide_shots` and `slide_assignments`, sender RPCs (service role only) | Run 19 Nov 2026 |
| `notifications-cron.sql` | `pg_cron` + `pg_net`: calls the Edge Function `notify-slack` every minute; the secret is read from Vault (`notify_cron_secret`) | Run 19 Nov 2026, after deploying `notify-slack` |
| `notifications-test.sql` | Test on one DM account with a fake order #999001, plus clean-up | Test only |
| `teams-setup.sql` | A strict per-team RLS design | **Parked, do not run** unless stricter security is wanted |

Add, move or remove a DM later (the list keeps `design_managers` and `profiles.team` in sync):
```sql
insert into public.dm_allowlist (email, name, team) values ('dm@24slides.com', 'Full Name', 'Cosmic');
update public.dm_allowlist set team = 'Alpha' where email = 'dm@24slides.com';
delete from public.dm_allowlist where email = 'dm@24slides.com';
```
An admin who is not a DM of a team can still be added straight to `design_managers`; the list never removes those rows.

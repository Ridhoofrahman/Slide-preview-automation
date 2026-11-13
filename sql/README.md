# SQL

- **`../slide-qa-marker/supabase-setup.sql` is the full, canonical setup.** On a new Supabase project run only that file in the SQL Editor.
- The files here are the incremental scripts as they were run on the live project, kept for reference, plus one parked design:

| File | What it does | Status |
|---|---|---|
| `teams-simple.sql` | Adds `slide_shots.team` | Run (already part of the canonical file) |
| `assign-setup.sql` | `profiles` and `slide_assignments` with policies and realtime | Run (already part of the canonical file) |
| `dm-setup.sql` | `design_managers`, `is_dm()`, and DM-only policies for review, comments, delete, status and distribution | Run (already part of the canonical file). **Change the seeded email to your own before running on a new project.** |
| `teams-setup.sql` | A strict per-team RLS design | **Parked, do not run** unless stricter security is wanted |

Add or remove a DM later:
```sql
insert into public.design_managers (user_id) select id from auth.users where email = 'dm@24slides.com';
delete from public.design_managers where user_id = (select id from auth.users where email = 'dm@24slides.com');
```

-- Members only: step 2 of 2. Run after designer-allowlist.sql, once its last query shows nobody who should keep access.
-- Adds one RESTRICTIVE policy per table. Postgres combines it with AND on top of the existing policies, so every
-- existing rule (DM-only review, designers insert their own slides, …) stays as it is, and on top of that the
-- signed-in account must be a member (public.is_member(): a DM, a listed designer or a listed DM).
-- Not on any list → the account can sign in, but reads and writes nothing (the add-in shows a no-access message).
-- Realtime follows the same rules. `teams` and `design_managers` stay readable (no client data in them).
-- Safe to run again. To undo, run the drop statements at the end.

drop policy if exists "members only" on public.slide_shots;
create policy "members only" on public.slide_shots as restrictive for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

drop policy if exists "members only" on public.shot_comments;
create policy "members only" on public.shot_comments as restrictive for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

drop policy if exists "members only" on public.project_status;
create policy "members only" on public.project_status as restrictive for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

drop policy if exists "members only" on public.slide_assignments;
create policy "members only" on public.slide_assignments as restrictive for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

drop policy if exists "members only" on public.profiles;
create policy "members only" on public.profiles as restrictive for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

-- Slide images and voice notes (bucket `slides`); other buckets are not affected
drop policy if exists "slides: members only" on storage.objects;
create policy "slides: members only" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'slides' or (select public.is_member()))
  with check (bucket_id <> 'slides' or (select public.is_member()));

-- Undo:
--   drop policy "members only" on public.slide_shots;      drop policy "members only" on public.shot_comments;
--   drop policy "members only" on public.project_status;   drop policy "members only" on public.slide_assignments;
--   drop policy "members only" on public.profiles;         drop policy "slides: members only" on storage.objects;

-- 11. Design managers: only DMs can use the review page, review slides and distribute slides
create table if not exists public.design_managers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.design_managers enable row level security;
drop policy if exists "DMs: everyone reads" on public.design_managers;
create policy "DMs: everyone reads" on public.design_managers for select to authenticated using (true);
-- (No write rules: the DM list is managed here in the SQL Editor.)
create or replace function public.is_dm() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.design_managers where user_id = auth.uid()) $$;

-- ✏️ Your design managers (add more e-mails to the list)
insert into public.design_managers (user_id)
select id from auth.users where lower(email) in ('ridhofadhlurrahman05@gmail.com')
on conflict (user_id) do nothing;

-- Reviewing, commenting, deleting and "sent to customer": DMs only
drop policy if exists "team updates shots"  on public.slide_shots;
drop policy if exists "team deletes shots"  on public.slide_shots;
drop policy if exists "DMs review shots"    on public.slide_shots;
drop policy if exists "DMs delete shots"    on public.slide_shots;
create policy "DMs review shots" on public.slide_shots for update to authenticated using (public.is_dm());
create policy "DMs delete shots" on public.slide_shots for delete to authenticated using (public.is_dm());

drop policy if exists "team adds comments"    on public.shot_comments;
drop policy if exists "team updates comments" on public.shot_comments;
drop policy if exists "team deletes comments" on public.shot_comments;
drop policy if exists "DMs add comments"      on public.shot_comments;
drop policy if exists "DMs update comments"   on public.shot_comments;
drop policy if exists "DMs delete comments"   on public.shot_comments;
create policy "DMs add comments"    on public.shot_comments for insert to authenticated with check (public.is_dm());
create policy "DMs update comments" on public.shot_comments for update to authenticated using (public.is_dm());
create policy "DMs delete comments" on public.shot_comments for delete to authenticated using (public.is_dm());

drop policy if exists "team adds project status"    on public.project_status;
drop policy if exists "team updates project status" on public.project_status;
drop policy if exists "team deletes project status" on public.project_status;
drop policy if exists "DMs add project status"      on public.project_status;
drop policy if exists "DMs update project status"   on public.project_status;
drop policy if exists "DMs delete project status"   on public.project_status;
create policy "DMs add project status"    on public.project_status for insert to authenticated with check (public.is_dm());
create policy "DMs update project status" on public.project_status for update to authenticated using (public.is_dm());
create policy "DMs delete project status" on public.project_status for delete to authenticated using (public.is_dm());

drop policy if exists "team deletes slide files" on storage.objects;
drop policy if exists "DMs delete slide files"   on storage.objects;
create policy "DMs delete slide files" on storage.objects for delete to authenticated using (bucket_id = 'slides' and public.is_dm());

-- Only DMs distribute slides
drop policy if exists "assignments: add"    on public.slide_assignments;
drop policy if exists "assignments: change" on public.slide_assignments;
drop policy if exists "assignments: remove" on public.slide_assignments;
create policy "assignments: add"    on public.slide_assignments for insert to authenticated with check (public.is_dm());
create policy "assignments: change" on public.slide_assignments for update to authenticated using (public.is_dm());
create policy "assignments: remove" on public.slide_assignments for delete to authenticated using (public.is_dm());

-- Add a DM later:    insert into public.design_managers (user_id) select id from auth.users where email = 'dm@24slides.com';
-- Remove a DM:       delete from public.design_managers where user_id = (select id from auth.users where email = 'dm@24slides.com');

-- Slide Review — paste this whole file into Supabase → SQL Editor → Run.

-- 1. Slides sent for review (one row per version of a slide)
create table if not exists public.slide_shots (
  id            uuid primary key default gen_random_uuid(),
  file_key      text not null,              -- identifies one PowerPoint file
  project       text not null,
  slide_id      text not null,              -- PowerPoint's own id for the slide
  slide_number  int  not null,
  total_slides  int  not null,
  version       int  not null default 1,
  designer      text not null,
  designer_id   uuid default auth.uid(),
  note          text,
  image_path    text not null,
  status        text not null default 'ready'
                check (status in ('ready', 'approved', 'changes')),
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists slide_shots_file_idx on public.slide_shots (file_key, slide_id, version desc);
create index if not exists slide_shots_created_idx on public.slide_shots (created_at desc);

-- 2. Comments and pinned annotations (x, y are 0–1 positions on the slide; empty = general comment)
create table if not exists public.shot_comments (
  id          uuid primary key default gen_random_uuid(),
  shot_id     uuid not null references public.slide_shots(id) on delete cascade,
  author      text not null,
  author_id   uuid default auth.uid(),
  body        text not null,
  x           real check (x between 0 and 1),
  y           real check (y between 0 and 1),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists shot_comments_shot_idx on public.shot_comments (shot_id, created_at);

-- 3. Only signed-in team members can read or write
alter table public.slide_shots   enable row level security;
alter table public.shot_comments enable row level security;

create policy "team reads shots"    on public.slide_shots   for select to authenticated using (true);
create policy "team adds shots"     on public.slide_shots   for insert to authenticated with check (true);
create policy "team updates shots"  on public.slide_shots   for update to authenticated using (true);

create policy "team reads comments"   on public.shot_comments for select to authenticated using (true);
create policy "team adds comments"    on public.shot_comments for insert to authenticated with check (true);
create policy "team updates comments" on public.shot_comments for update to authenticated using (true);

-- 4. Private bucket for slide images (no public links)
insert into storage.buckets (id, name, public)
values ('slides', 'slides', false)
on conflict (id) do nothing;

create policy "team reads slide images"   on storage.objects for select to authenticated using (bucket_id = 'slides');
create policy "team uploads slide images" on storage.objects for insert to authenticated with check (bucket_id = 'slides');

-- 5. Live updates (new slides and comments appear without refreshing)
alter publication supabase_realtime add table public.slide_shots, public.shot_comments;

-- 6. Slide details for QA (fonts, sizes, speaker notes) — added later
alter table public.slide_shots add column if not exists details jsonb;

-- 7. Voice notes on comments (up to 2 minutes) — added later
alter table public.shot_comments add column if not exists audio_path text, add column if not exists audio_duration real;

-- 8. Let the team delete finished projects (rows, comments and files) — added later
create policy "team deletes shots"       on public.slide_shots   for delete to authenticated using (true);
create policy "team deletes comments"    on public.shot_comments for delete to authenticated using (true);
create policy "team deletes slide files" on storage.objects      for delete to authenticated using (bucket_id = 'slides');

-- 9. Project status: "sent to customer" — added later
create table if not exists public.project_status (
  key        text primary key,          -- project name, trimmed and lower-cased
  name       text not null,
  sent_at    timestamptz,
  sent_by    text,
  updated_at timestamptz not null default now()
);
alter table public.project_status enable row level security;
create policy "team reads project status"   on public.project_status for select to authenticated using (true);
create policy "team adds project status"    on public.project_status for insert to authenticated with check (true);
create policy "team updates project status" on public.project_status for update to authenticated using (true);
create policy "team deletes project status" on public.project_status for delete to authenticated using (true);
alter publication supabase_realtime add table public.project_status;

-- 9. Teams (simple): designers and DMs pick their team at sign-in; each slide records the sender's team
alter table public.slide_shots add column if not exists team text;
-- 13. Teams: the list of teams, by office (the add-in and the Dashboard fill their team dropdown from here)
-- Spelling matches Inner Platform. Add or retire a team with an insert / `update public.teams set active = false`.
-- RLS: signed-in users can read; nobody writes from the client (edit here in the SQL Editor, later synced from Inner Platform).
create table if not exists public.teams (
  name   text primary key,
  office text not null,
  active boolean not null default true
);
alter table public.teams enable row level security;
drop policy if exists "teams: everyone reads" on public.teams;
create policy "teams: everyone reads" on public.teams for select to authenticated using (true);
revoke insert, update, delete on public.teams from anon, authenticated;

insert into public.teams (name, office) values
  ('Ablaze','Indonesia'),('Alpha','Indonesia'),('Avvenger','Indonesia'),('Bright','Indonesia'),('Cascade','Indonesia'),
  ('Clementine','Indonesia'),('Clover','Indonesia'),('Cosmic','Indonesia'),('Fortis','Indonesia'),('Fourtastic','Indonesia'),
  ('Horme','Indonesia'),('Hustle','Indonesia'),('Jackdaw','Indonesia'),('Magnetic','Indonesia'),('Meraki','Indonesia'),
  ('Nucleonz','Indonesia'),('Phoenix','Indonesia'),('Radiant','Indonesia'),('Sirius','Indonesia'),('Titant','Indonesia'),
  ('Vincero','Indonesia'),
  ('Alpaka','Peru'),('Kaleido','Peru'),('Polaris','Peru')
on conflict (name) do nothing;

-- 10. Slide assignments: a DM splits an order between designers (e.g. 1-5 → Budi, 6-10 → Rina)
-- Who's who: every account saves its name and team here when it signs in (used for the designer picker)
create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  team       text references public.teams(name),   -- nullable; see sql/profiles-team-fk.sql for an existing project
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: everyone reads" on public.profiles;
drop policy if exists "profiles: add mine"      on public.profiles;
drop policy if exists "profiles: update mine"   on public.profiles;
create policy "profiles: everyone reads" on public.profiles for select to authenticated using (true);
create policy "profiles: add mine"       on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "profiles: update mine"    on public.profiles for update to authenticated using (user_id = auth.uid());

-- One row per designer per order; slides are slide numbers in the deck
create table if not exists public.slide_assignments (
  id            uuid primary key default gen_random_uuid(),
  order_key     text not null,            -- lower-case order name, e.g. 'order #351164'
  order_name    text not null,            -- as shown, e.g. 'Order #351164'
  assignee_id   uuid not null,
  assignee_name text not null,
  assignee_team text,
  slides        int[] not null,
  created_by    text,
  created_team  text,
  created_at    timestamptz not null default now()
);
create index if not exists slide_assignments_order_idx on public.slide_assignments (order_key);
alter table public.slide_assignments enable row level security;
drop policy if exists "assignments: everyone reads" on public.slide_assignments;
drop policy if exists "assignments: add"            on public.slide_assignments;
drop policy if exists "assignments: change"         on public.slide_assignments;
drop policy if exists "assignments: remove"         on public.slide_assignments;
create policy "assignments: everyone reads" on public.slide_assignments for select to authenticated using (true);
create policy "assignments: add"            on public.slide_assignments for insert to authenticated with check (true);
create policy "assignments: change"         on public.slide_assignments for update to authenticated using (true);
create policy "assignments: remove"         on public.slide_assignments for delete to authenticated using (true);

-- Live updates in the add-in when the DM changes the split
alter publication supabase_realtime add table public.slide_assignments;
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

-- 12. Slack sign-in handoff for the PowerPoint add-in
-- The add-in opens Slack in the system browser (PowerPoint for Mac's embedded dialog is refused by Slack).
-- The browser parks the session here under a one-time code that only the add-in knows; the add-in picks it up once.
-- Only the Edge Function `login-handoff` (service role) touches this table: RLS is on with no policies,
-- so the anon and signed-in roles can't read or write it. Rows live 5 minutes and are deleted when read.
create table if not exists public.login_handoffs (
  code          text primary key check (char_length(code) between 32 and 128),
  access_token  text,
  refresh_token text,
  error         text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '5 minutes'
);
alter table public.login_handoffs enable row level security;
revoke all on public.login_handoffs from anon, authenticated;

-- 14. DM list (dm_allowlist): who is a DM and which team they lead; keeps design_managers and profiles.team in sync
-- 1. The list
create table if not exists public.dm_allowlist (
  email      text primary key check (email = lower(email)),
  name       text not null,
  team       text not null references public.teams(name),
  created_at timestamptz not null default now()
);
alter table public.dm_allowlist enable row level security;   -- no policies: clients can't read or write it
revoke all on public.dm_allowlist from anon, authenticated;

-- 2. Remember which DM rows came from the list, so removing someone from the list removes only those
alter table public.design_managers add column if not exists from_allowlist boolean not null default false;

-- 3. Give one listed email its DM row and profile (if the account exists)
create or replace function public.dm_allowlist_apply(p_email text) returns void
  language plpgsql security definer set search_path = public as $$
declare a public.dm_allowlist; uid uuid;
begin
  select * into a from public.dm_allowlist where email = lower(p_email);
  if not found then return; end if;
  select id into uid from auth.users where lower(email) = a.email;
  if uid is null then return; end if;                       -- no account yet: the auth.users trigger applies it later
  insert into public.design_managers (user_id, from_allowlist) values (uid, true)
    on conflict (user_id) do nothing;                       -- an existing manual DM stays manual
  insert into public.profiles (user_id, name, team) values (uid, a.name, a.team)
    on conflict (user_id) do update set team = excluded.team, updated_at = now();   -- keep the name they already use
end $$;

-- 4. List changes → sync
create or replace function public.dm_allowlist_sync() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.email <> new.email) then
    delete from public.design_managers
     where from_allowlist and user_id in (select id from auth.users where lower(email) = old.email);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.dm_allowlist_apply(new.email); end if;
  return null;
end $$;
drop trigger if exists dm_allowlist_sync on public.dm_allowlist;
create trigger dm_allowlist_sync after insert or update or delete on public.dm_allowlist
  for each row execute function public.dm_allowlist_sync();

-- 5. New account → if its email is on the list, it is a DM from the first sign-in
create or replace function public.dm_allowlist_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.dm_allowlist_apply(new.email);
  exception when others then
    raise warning 'dm_allowlist: % for %', sqlerrm, new.email;   -- never block creating an account
  end;
  return null;
end $$;
drop trigger if exists dm_allowlist_new_user on auth.users;
create trigger dm_allowlist_new_user after insert on auth.users
  for each row execute function public.dm_allowlist_new_user();

-- 6. The DMs (from Inner Platform, 18 Nov 2026): one DM per team
insert into public.dm_allowlist (email, name, team) values
  ('firdaus@24slides.com',      'Aidul Firdaus',          'Ablaze'),
  ('nenes@24slides.com',        'Nenes Ayuningtyas',      'Alpha'),
  ('ramaditya@24slides.com',    'Ramaditya Ananda',       'Avvenger'),
  ('reinald@24slides.com',      'Reinald Victorio',       'Bright'),
  ('haryo@24slides.com',        'Haryo Adi',              'Cascade'),
  ('sheila@24slides.com',       'Sheila Aprilia',         'Clementine'),
  ('erybagas@24slides.com',     'Ery Bagas',              'Clover'),
  ('danny@24slides.com',        'Danny Astrianto',        'Cosmic'),
  ('edo@24slides.com',          'Eduard Pitoyo',          'Fortis'),
  ('benny@24slides.com',        'Benny Prasetyo',         'Fourtastic'),
  ('nugroho@24slides.com',      'Nugroho Ade',            'Horme'),
  ('dika@24slides.com',         'Dika Putri',             'Hustle'),
  ('rengga@24slides.com',       'Rengga Zulkarnaen',      'Jackdaw'),
  ('fero@24slides.com',         'Feronika Wulandari',     'Magnetic'),
  ('indah@24slides.com',        'Indah Yuniarti',         'Meraki'),
  ('zen@24slides.com',          'Zen',                    'Nucleonz'),
  ('redy@24slides.com',         'Mohammad Redyanto',      'Phoenix'),
  ('cessarrio@24slides.com',    'Cessarrio Novrian',      'Radiant'),
  ('varief@24slides.com',       'Varief Setyawan',        'Sirius'),
  ('habillian@24slides.com',    'Habillian Baskoro',      'Titant'),
  ('budhi@24slides.com',        'Purwantoro Priyambudhi', 'Vincero'),
  ('brianaripas@24slides.com',  'Briana Ripas',           'Alpaka'),
  ('anacorina@24slides.com',    'Corina Rivera',          'Kaleido'),
  ('sebastian@24slides.com',    'Sebastian Romero',       'Polaris')
on conflict (email) do update set name = excluded.name, team = excluded.team;

-- 7. Check: who on the list still needs an account (create these in Authentication → Users, same e-mail as their Slack)
select l.email, l.name, l.team, (u.id is not null) as has_account, (d.user_id is not null) as is_dm
from public.dm_allowlist l
left join auth.users u on lower(u.email) = l.email
left join public.design_managers d on d.user_id = u.id
order by has_account, l.team;

-- Later:
--   Add a DM:      insert into public.dm_allowlist (email, name, team) values ('new.dm@24slides.com', 'Full Name', 'Cosmic');
--   Change team:   update public.dm_allowlist set team = 'Alpha' where email = 'new.dm@24slides.com';
--   Remove a DM:   delete from public.dm_allowlist where email = 'new.dm@24slides.com';

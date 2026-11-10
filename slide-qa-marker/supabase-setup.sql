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
-- 10. Slide assignments: a DM splits an order between designers (e.g. 1-5 → Budi, 6-10 → Rina)
-- Who's who: every account saves its name and team here when it signs in (used for the designer picker)
create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  team       text,
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

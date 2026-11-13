-- =====================================================================
-- Slideshot · Teams
-- Each designer and DM belongs to ONE team.
-- An order can be worked on by several teams ("tag team"): any team that
-- sends slides for the same order number joins that order automatically.
-- Everyone in a joined team sees the whole deck; each team's DM reviews
-- only their own team's slides.
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- =====================================================================

-- 1. Teams and members (one team per person)
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.team_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  role       text not null check (role in ('designer', 'dm')),
  created_at timestamptz not null default now()
);
alter table public.slide_shots add column if not exists team_id uuid references public.teams(id);
create index if not exists slide_shots_team_idx  on public.slide_shots (team_id);
create index if not exists slide_shots_order_idx on public.slide_shots ((lower(btrim(project))));

-- 2. Helpers used by the access rules (security definer so they can read membership)
create or replace function public.my_team() returns uuid
  language sql stable security definer set search_path = public
  as $$ select team_id from public.team_members where user_id = auth.uid() $$;
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public
  as $$ select role from public.team_members where user_id = auth.uid() $$;
-- True when my team has sent at least one slide for this order (orders are matched by name, e.g. "Order #351164")
create or replace function public.can_see_order(p text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.slide_shots
                       where team_id = public.my_team() and lower(btrim(project)) = lower(btrim(p))) $$;

-- 3. New slides are always filed under the sender's team
create or replace function public.slide_shots_set_team() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  new.team_id := public.my_team();
  if new.team_id is null then
    raise exception 'You are not in a team yet. Ask your design manager to add you.';
  end if;
  return new;
end $$;
drop trigger if exists slide_shots_set_team on public.slide_shots;
create trigger slide_shots_set_team before insert on public.slide_shots
  for each row execute function public.slide_shots_set_team();

-- 4. Put everyone who already uses Slideshot into a first team.
--    ✏️ Edit the team name and the DM e-mail list before running.
insert into public.teams (name) values ('Team 1') on conflict (name) do nothing;
insert into public.team_members (user_id, team_id, role)
select u.id, t.id,
       case when lower(u.email) in ('ridhofadhlurrahman05@gmail.com') then 'dm' else 'designer' end
from auth.users u cross join (select id from public.teams where name = 'Team 1') t
on conflict (user_id) do nothing;
update public.slide_shots set team_id = (select id from public.teams where name = 'Team 1') where team_id is null;

-- 5. Access rules (replace the old "everyone signed in can do everything" rules)
drop policy if exists "team reads shots"    on public.slide_shots;
drop policy if exists "team adds shots"     on public.slide_shots;
drop policy if exists "team updates shots"  on public.slide_shots;
drop policy if exists "team deletes shots"  on public.slide_shots;
drop policy if exists "shots: read orders my team works on" on public.slide_shots;
drop policy if exists "shots: designers send as themselves" on public.slide_shots;
drop policy if exists "shots: DM reviews own team"          on public.slide_shots;
drop policy if exists "shots: DM deletes own team"          on public.slide_shots;
create policy "shots: read orders my team works on" on public.slide_shots for select to authenticated
  using (team_id = public.my_team() or public.can_see_order(project));
create policy "shots: designers send as themselves" on public.slide_shots for insert to authenticated
  with check (designer_id = auth.uid() and public.my_team() is not null);
create policy "shots: DM reviews own team" on public.slide_shots for update to authenticated
  using (public.my_role() = 'dm' and team_id = public.my_team());
create policy "shots: DM deletes own team" on public.slide_shots for delete to authenticated
  using (public.my_role() = 'dm' and team_id = public.my_team());

drop policy if exists "team reads comments"   on public.shot_comments;
drop policy if exists "team adds comments"    on public.shot_comments;
drop policy if exists "team updates comments" on public.shot_comments;
drop policy if exists "team deletes comments" on public.shot_comments;
drop policy if exists "comments: read on visible slides" on public.shot_comments;
drop policy if exists "comments: DMs add"                on public.shot_comments;
drop policy if exists "comments: DMs resolve"            on public.shot_comments;
drop policy if exists "comments: DM deletes own team"    on public.shot_comments;
create policy "comments: read on visible slides" on public.shot_comments for select to authenticated
  using (exists (select 1 from public.slide_shots s where s.id = shot_id));
create policy "comments: DMs add" on public.shot_comments for insert to authenticated
  with check (public.my_role() = 'dm' and author_id = auth.uid()
              and exists (select 1 from public.slide_shots s where s.id = shot_id));
create policy "comments: DMs resolve" on public.shot_comments for update to authenticated
  using (public.my_role() = 'dm' and exists (select 1 from public.slide_shots s where s.id = shot_id));
create policy "comments: DM deletes own team" on public.shot_comments for delete to authenticated
  using (public.my_role() = 'dm' and exists (select 1 from public.slide_shots s where s.id = shot_id and s.team_id = public.my_team()));

drop policy if exists "team reads project status"   on public.project_status;
drop policy if exists "team adds project status"    on public.project_status;
drop policy if exists "team updates project status" on public.project_status;
drop policy if exists "team deletes project status" on public.project_status;
drop policy if exists "orders: read mine"   on public.project_status;
drop policy if exists "orders: DMs mark"    on public.project_status;
drop policy if exists "orders: DMs update"  on public.project_status;
drop policy if exists "orders: DMs delete"  on public.project_status;
create policy "orders: read mine"  on public.project_status for select to authenticated using (public.can_see_order(key));
create policy "orders: DMs mark"   on public.project_status for insert to authenticated with check (public.my_role() = 'dm' and public.can_see_order(key));
create policy "orders: DMs update" on public.project_status for update to authenticated using (public.my_role() = 'dm' and public.can_see_order(key));
create policy "orders: DMs delete" on public.project_status for delete to authenticated using (public.my_role() = 'dm' and public.can_see_order(key));

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
drop policy if exists "teams: names are visible"   on public.teams;
drop policy if exists "members: me and my team"    on public.team_members;
create policy "teams: names are visible" on public.teams for select to authenticated using (true);
create policy "members: me and my team"  on public.team_members for select to authenticated
  using (user_id = auth.uid() or team_id = public.my_team());
-- (No insert/update rules on teams or members: they are managed here in the SQL Editor or the Table Editor.)

-- Images and voice notes: readable only if you can see the slide or comment that uses them
drop policy if exists "team reads slide images"   on storage.objects;
drop policy if exists "team uploads slide images" on storage.objects;
drop policy if exists "team deletes slide files"  on storage.objects;
drop policy if exists "files: read what I can see" on storage.objects;
drop policy if exists "files: team members upload" on storage.objects;
drop policy if exists "files: DMs delete"          on storage.objects;
create policy "files: read what I can see" on storage.objects for select to authenticated
  using (bucket_id = 'slides' and (
         exists (select 1 from public.slide_shots s where s.image_path = name)
      or exists (select 1 from public.shot_comments c where c.audio_path = name)));
create policy "files: team members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'slides' and public.my_team() is not null);
create policy "files: DMs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'slides' and public.my_role() = 'dm');

-- =====================================================================
-- Managing teams later (copy the line you need, fill in, run)
-- =====================================================================
-- New team:            insert into public.teams (name) values ('Team 2');
-- Add a designer:      insert into public.team_members (user_id, team_id, role)
--                      select u.id, t.id, 'designer' from auth.users u, public.teams t
--                      where u.email = 'designer@24slides.com' and t.name = 'Team 2';
-- Add a DM:            same as above with 'dm'
-- Move to other team:  update public.team_members set team_id = (select id from public.teams where name = 'Team 2')
--                      where user_id = (select id from auth.users where email = 'designer@24slides.com');
-- Remove from team:    delete from public.team_members where user_id = (select id from auth.users where email = 'designer@24slides.com');
-- Who is in which team:
--   select t.name as team, m.role, u.email from public.team_members m
--   join public.teams t on t.id = m.team_id join auth.users u on u.id = m.user_id order by 1, 2, 3;

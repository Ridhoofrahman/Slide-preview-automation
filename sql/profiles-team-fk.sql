-- 14. profiles.team becomes a (nullable) foreign key to teams.name.
-- Run sql/teams-table.sql first. STEP 1 must return no rows before step 2 will work.

-- STEP 1: profiles whose team is not in the list (e.g. Trident). Decide for each: move to a real team, or set to null.
select p.user_id, p.name, p.team
from public.profiles p
where p.team is not null and not exists (select 1 from public.teams t where t.name = p.team)
order by p.team, p.name;

-- STEP 1b (examples, only after deciding):
--   update public.profiles set team = null      where team = 'Trident';   -- they pick again at next sign-in
--   update public.profiles set team = 'Cosmic'  where team = 'Trident';   -- or move them

-- STEP 2: add the foreign key
alter table public.profiles
  drop constraint if exists profiles_team_fkey,
  add  constraint profiles_team_fkey foreign key (team) references public.teams(name);

-- DM list: who is a Design Manager and which team they lead.
-- public.dm_allowlist is the source of truth. Triggers keep two things in sync with it:
--   - public.design_managers (what both apps and is_dm() read): a listed email is a DM; removed from the list = no longer a DM
--   - public.profiles (name + team): a listed DM gets the team from the list and never sees the team step
-- It works for accounts that exist now and for accounts created later (the moment an admin creates the account).
-- Manual DMs (rows in design_managers not from this list, e.g. the admin) are left alone.
-- Edit the list here in the SQL Editor (no client writes). Run after teams-table.sql.

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

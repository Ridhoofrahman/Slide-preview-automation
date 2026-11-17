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

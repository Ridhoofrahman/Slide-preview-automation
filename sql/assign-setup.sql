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

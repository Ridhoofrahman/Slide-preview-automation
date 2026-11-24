-- Final files on Google Drive (phase 3): one row per order and stage, written only by the Edge Function drive-upload
-- (service role). DMs read them (dashboard "Copy final file link", panel's next stage and file name). Safe to run again.
create table if not exists public.deliveries (
  id               uuid primary key default gen_random_uuid(),
  order_key        text not null,              -- digits only, e.g. '351164'
  stage            text not null,              -- 'First Draft', 'Revision 1', …
  name             text not null,              -- the middle part of the file name, e.g. 'Kingfish Group IS'
  file_name        text not null,              -- '351164_Kingfish Group IS_First Draft.pptx'
  file_id          text not null,              -- Google Drive file id
  link             text not null,              -- https://drive.google.com/file/d/<id>/view
  size_bytes       bigint,
  uploaded_by      uuid,
  uploaded_by_name text,
  uploaded_at      timestamptz not null default now(),
  unique (order_key, stage)
);
create index if not exists deliveries_order_idx on public.deliveries (order_key, uploaded_at desc);
alter table public.deliveries enable row level security;
drop policy if exists "deliveries: DMs read" on public.deliveries;
drop policy if exists "members only" on public.deliveries;
create policy "deliveries: DMs read" on public.deliveries for select to authenticated using (public.is_dm());
create policy "members only" on public.deliveries as restrictive for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
-- No insert/update/delete policies: only the Edge Function (service role) writes.

-- Check: should list 2 policies
select policyname, cmd, permissive from pg_policies where tablename = 'deliveries' order by policyname;
-- Undo: drop table public.deliveries;

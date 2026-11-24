-- Slide files for compile (phase 1): every slide a designer sends is also kept as its own one-slide .pptx.
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- Storage path: <order digits>/<uploader user id>/<file key>_<slide id>.pptx   (bucket `slide-files`, private)
-- One row per slide in public.slide_files, always the latest version; sending a new version replaces the file.
-- Who: a designer uploads only for orders a DM assigned them (or any order if they are a DM). DMs read every file,
-- a designer reads only their own. Only DMs delete. Members only, nothing public.

-- 1. Table
create table if not exists public.slide_files (
  id             uuid primary key default gen_random_uuid(),
  order_key      text not null,                 -- digits only, e.g. '351164'
  project        text not null,                 -- order name as sent, e.g. 'Order #351164'
  file_key       text not null,                 -- slide_shots.file_key of the sender's file
  slide_id       text not null,                 -- PowerPoint's own slide id
  slide_number   int  not null,                 -- position in the order (alternatives: the slide they are an alternative of)
  alternative_of int,
  shot_id        uuid references public.slide_shots (id) on delete set null,
  version        int  not null,                 -- same as slide_shots.version
  storage_path   text not null,
  size_bytes     bigint not null,
  team           text,
  uploaded_by    uuid not null default auth.uid(),
  uploaded_at    timestamptz not null default now(),
  unique (file_key, slide_id)
);
create index if not exists slide_files_order_idx on public.slide_files (order_key);
alter table public.slide_files enable row level security;

-- 2. May I upload for this order? DMs always; designers when a DM assigned them slides in it.
create or replace function public.can_upload_slide_file(order_digits text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_dm() or exists (
    select 1 from public.slide_assignments a
    where a.assignee_id = auth.uid() and regexp_replace(a.order_key, '\D', '', 'g') = order_digits)
$$;
revoke execute on function public.can_upload_slide_file(text) from public, anon;
grant execute on function public.can_upload_slide_file(text) to authenticated;

-- 3. Table rules
drop policy if exists "slide files: read"   on public.slide_files;
drop policy if exists "slide files: add"    on public.slide_files;
drop policy if exists "slide files: change" on public.slide_files;
drop policy if exists "slide files: remove" on public.slide_files;
drop policy if exists "members only"        on public.slide_files;
create policy "slide files: read"   on public.slide_files for select to authenticated using (public.is_dm() or uploaded_by = auth.uid());
create policy "slide files: add"    on public.slide_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_upload_slide_file(order_key));
create policy "slide files: change" on public.slide_files for update to authenticated
  using (uploaded_by = auth.uid()) with check (uploaded_by = auth.uid() and public.can_upload_slide_file(order_key));
create policy "slide files: remove" on public.slide_files for delete to authenticated using (public.is_dm());
create policy "members only" on public.slide_files as restrictive for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

-- 4. Private bucket: .pptx only, 50 MB per file (the Free plan's limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slide-files', 'slide-files', false, 52428800, array['application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 5. Storage rules (folder 1 = order digits, folder 2 = uploader's user id). Replacing a file (upsert) needs read + update too.
drop policy if exists "slide files: upload"  on storage.objects;
drop policy if exists "slide files: replace" on storage.objects;
drop policy if exists "slide files: open"    on storage.objects;
drop policy if exists "slide files: delete"  on storage.objects;
drop policy if exists "slide files: members only" on storage.objects;
create policy "slide files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'slide-files' and (storage.foldername(name))[2] = auth.uid()::text
              and public.can_upload_slide_file((storage.foldername(name))[1]));
create policy "slide files: replace" on storage.objects for update to authenticated
  using (bucket_id = 'slide-files' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'slide-files' and (storage.foldername(name))[2] = auth.uid()::text
              and public.can_upload_slide_file((storage.foldername(name))[1]));
create policy "slide files: open" on storage.objects for select to authenticated
  using (bucket_id = 'slide-files' and (public.is_dm() or (storage.foldername(name))[2] = auth.uid()::text));
create policy "slide files: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'slide-files' and public.is_dm());
create policy "slide files: members only" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'slide-files' or (select public.is_member()))
  with check (bucket_id <> 'slide-files' or (select public.is_member()));

-- 6. Check: should list the bucket (public = false) and 4 + 1 table policies
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'slide-files';
select policyname, cmd, permissive from pg_policies where tablename = 'slide_files' order by policyname;

-- Undo:
--   drop table public.slide_files;  drop function public.can_upload_slide_file(text);
--   drop policy "slide files: upload" on storage.objects;  drop policy "slide files: replace" on storage.objects;
--   drop policy "slide files: open" on storage.objects;    drop policy "slide files: delete" on storage.objects;
--   drop policy "slide files: members only" on storage.objects;
--   (empty the bucket in Storage first, then) delete from storage.buckets where id = 'slide-files';

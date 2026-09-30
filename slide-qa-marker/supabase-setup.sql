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

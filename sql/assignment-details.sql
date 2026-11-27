-- Assign order dialog, new fields (Figma 1107:27508) and the Distribution table (Figma 465:14440).
-- Order level (the same value on every row of the order): stage, internal.
--   The deadline is now one per order too; it stays in the existing column `deadline` (sql/deadlines.sql).
-- Per designer: the slides split by treatment, and a note.
--   treatments = {"fu": [1,2,3], "rd": [4], "rw": [5,6]}  (Fix-up, Redesign, Redraw)
--   `slides` stays the union of the three, so the add-in, notifications and progress keep working unchanged.
--   note_by = who wrote the note (the DM who saved the distribution); the Distribution tab shows their photo.
-- Run once in the SQL Editor (safe to run again). Until it has run, the dashboard saves the distribution
-- without these fields and says so.

alter table public.slide_assignments add column if not exists stage      text;
alter table public.slide_assignments add column if not exists internal   boolean not null default false;
alter table public.slide_assignments add column if not exists treatments jsonb;
alter table public.slide_assignments add column if not exists note       text;
alter table public.slide_assignments add column if not exists note_by    uuid default auth.uid();

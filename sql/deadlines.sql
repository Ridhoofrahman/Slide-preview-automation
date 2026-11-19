-- Deadlines per designer per order (Dashboard: Assign order dialog + Distribution tab).
-- The DM sets when each designer should finish their slides of an order, e.g. 14:00 even if the client
-- deadline is 17:00. Stored with the time zone; every viewer sees it in their own local time.
-- Run once in the SQL Editor (safe to run again). Existing distributions keep working: their deadline is empty
-- until the DM saves them again (the dialog then asks for one).

alter table public.slide_assignments add column if not exists deadline timestamptz;

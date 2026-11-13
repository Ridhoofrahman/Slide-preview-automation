-- 9. Teams (simple): designers and DMs pick their team at sign-in; each slide records the sender's team
alter table public.slide_shots add column if not exists team text;

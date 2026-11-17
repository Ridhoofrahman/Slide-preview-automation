-- 12. Slack sign-in handoff for the PowerPoint add-in
-- The add-in opens Slack in the system browser (PowerPoint for Mac's embedded dialog is refused by Slack).
-- The browser parks the session here under a one-time code that only the add-in knows; the add-in picks it up once.
-- Only the Edge Function `login-handoff` (service role) touches this table: RLS is on with no policies,
-- so the anon and signed-in roles can't read or write it. Rows live 5 minutes and are deleted when read.
create table if not exists public.login_handoffs (
  code          text primary key check (char_length(code) between 32 and 128),
  access_token  text,
  refresh_token text,
  error         text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '5 minutes'
);
alter table public.login_handoffs enable row level security;
revoke all on public.login_handoffs from anon, authenticated;

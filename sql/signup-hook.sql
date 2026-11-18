-- Sign-up through Slack, for @24slides.com only.
-- The first Slack sign-in creates the account. This function runs as the Supabase Auth hook "Before User Created"
-- and rejects any email outside 24slides.com (the error message reaches the sign-in page as error_description).
-- Setup, all in the Supabase dashboard:
--   1. Run this file in the SQL Editor.
--   2. Authentication → Hooks → Add hook → Before User Created → Postgres function public.hook_slideshot_signup.
--   3. Authentication → Sign In / Providers: "Allow new users to sign up" on; "Confirm email" stays on.
-- A listed DM (dm_allowlist.sql) becomes a DM with their team the moment the account is created.

-- The function as it runs on the live project (pg_get_functiondef, 18 Nov 2026)
CREATE OR REPLACE FUNCTION public.hook_slideshot_signup(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  domain text := lower(split_part(event->'user'->>'email', '@', 2));
begin
  if domain = any (array['24slides.com']) then
    return '{}'::jsonb;                          -- boleh mendaftar
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Only 24Slides accounts can join Slideshot.'));
end;
$function$
;

-- Permissions recommended by Supabase for Auth hooks (not part of pg_get_functiondef; safe to run again):
-- only the Auth service may call the hook, not signed-in users or the public API.
grant execute on function public.hook_slideshot_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_slideshot_signup(jsonb) from authenticated, anon, public;

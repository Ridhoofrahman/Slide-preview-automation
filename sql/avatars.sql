-- Profile photos from Slack (2026-11-26). Run once in Supabase → SQL Editor. Safe to run again.
--
-- When someone signs in with "Continue with Slack", the Slack identity carries their photo URL. This keeps a copy in
-- public.profiles.avatar_url so every member can show it (profiles are readable by members; auth tables are not).
-- The copy is refreshed on every Slack sign-in (Supabase rewrites the identity then), so a new Slack photo shows up
-- after the next sign-in. People who never signed in with Slack have no photo: the apps show their initials.

-- 0. Check first (read-only): what the Slack identity holds
-- select u.email, i.identity_data->>'picture' as picture, i.identity_data->>'https://slack.com/user_image_192' as img192
--   from auth.identities i join auth.users u on u.id = i.user_id where i.provider = 'slack_oidc' limit 5;

-- 1. Column
alter table public.profiles add column if not exists avatar_url text;

-- 2. Photo URL from a Slack identity (192px is plenty for a 32px avatar on a retina screen)
create or replace function public.slack_photo(d jsonb) returns text
  language sql immutable set search_path = public
  as $$ select nullif(coalesce(d->>'https://slack.com/user_image_192', d->>'https://slack.com/user_image_72', d->>'picture'), '') $$;

-- 3. On every Slack sign-in (identity added or refreshed): copy the photo to the profile
create or replace function public.sync_slack_avatar() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if new.provider = 'slack_oidc' and public.slack_photo(new.identity_data) is not null then
    update public.profiles set avatar_url = public.slack_photo(new.identity_data)
     where user_id = new.user_id and avatar_url is distinct from public.slack_photo(new.identity_data);
  end if;
  return new;
end $$;
drop trigger if exists slack_avatar_sync on auth.identities;
create trigger slack_avatar_sync after insert or update of identity_data on auth.identities
  for each row execute function public.sync_slack_avatar();

-- 4. A profile created after the sign-in (first team step): take the photo from the identity right away
create or replace function public.fill_profile_avatar() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if new.avatar_url is null then
    select public.slack_photo(i.identity_data) into new.avatar_url
      from auth.identities i where i.user_id = new.user_id and i.provider = 'slack_oidc'
     order by i.updated_at desc nulls last limit 1;
  end if;
  return new;
end $$;
drop trigger if exists profile_avatar_fill on public.profiles;
create trigger profile_avatar_fill before insert on public.profiles
  for each row execute function public.fill_profile_avatar();

-- 5. Everyone who already signed in with Slack
update public.profiles p set avatar_url = public.slack_photo(i.identity_data)
  from auth.identities i
 where i.user_id = p.user_id and i.provider = 'slack_oidc' and public.slack_photo(i.identity_data) is not null;

-- 6. Check: how many profiles have a photo now
select count(*) filter (where avatar_url is not null) as with_photo, count(*) as profiles from public.profiles;

-- Undo:
--   drop trigger slack_avatar_sync on auth.identities; drop trigger profile_avatar_fill on public.profiles;
--   drop function public.sync_slack_avatar(); drop function public.fill_profile_avatar(); drop function public.slack_photo(jsonb);
--   alter table public.profiles drop column avatar_url;

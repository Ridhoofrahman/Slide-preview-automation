-- Slack notifications, step 1 of 2: the queue, the triggers that fill it and the RPCs the sender uses.
-- Spec: docs/specs/slack-notifications.md. Step 2 (after the Edge Function notify-slack is deployed):
-- sql/notifications-cron.sql, which calls the function every minute.
--
-- How it works: triggers on slide_shots and slide_assignments write one row per (event, recipient) into
-- public.notification_queue and do nothing else, so Slack can never block sending or reviewing a slide.
-- Rows of the same recipient + order + event (+ designer, for DM messages) share one send_after time:
-- the first event of the group + its window (3 min sent/revised, 5 min decisions, 1 min assignments).
-- The Edge Function claims due groups, writes one Slack message per group and marks the rows sent.
-- Nobody is told about their own action. Only the service role reads or writes the queue.
-- Safe to run again.

-- 0. Check first (read-only): where Slack keeps the user id in the sign-in identity.
--    Expect a value like U012AB3CD in slack_user_id or sub. Run on its own if you want to look before the rest.
-- select u.email, i.identity_data->>'https://slack.com/user_id' as slack_user_id, i.identity_data->>'sub' as sub
--   from auth.identities i join auth.users u on u.id = i.user_id where i.provider = 'slack_oidc' limit 5;

-- 1. Slack user id cache on profiles (filled from the Slack sign-in, or by the sender via users.lookupByEmail)
alter table public.profiles add column if not exists slack_user_id text;

update public.profiles p
   set slack_user_id = coalesce(i.identity_data->>'https://slack.com/user_id', i.identity_data->>'sub')
  from auth.identities i
 where i.user_id = p.user_id and i.provider = 'slack_oidc' and p.slack_user_id is null
   and coalesce(i.identity_data->>'https://slack.com/user_id', i.identity_data->>'sub') ~ '^[UW][A-Z0-9]+$';

-- Alternative slides (sql/alternatives.sql): the trigger below reads this column
alter table public.slide_shots add column if not exists alternative_of int;

-- 2. The queue
create table if not exists public.notification_queue (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  event         text not null check (event in ('slide_sent','slide_revised','assignment_changed','changes_requested','approved')),
  recipient_id  uuid not null,
  actor_id      uuid,
  actor_name    text,
  order_key     text not null,              -- digits only, e.g. '351164'
  payload       jsonb not null default '{}',
  group_key     text not null,              -- recipient|order|event[|designer]
  send_after    timestamptz not null,
  claimed_at    timestamptz,                -- set while a sender run works on the row
  sent_at       timestamptz,
  message       text,                       -- what was sent (or would be, in DRY_RUN); null = nothing to say
  attempts      int not null default 0,
  last_error    text
);
create index if not exists notification_queue_due_idx   on public.notification_queue (send_after) where sent_at is null;
create index if not exists notification_queue_group_idx on public.notification_queue (group_key) where sent_at is null;
alter table public.notification_queue enable row level security;   -- no policies: clients can't read or write it
revoke all on public.notification_queue from anon, authenticated;
revoke all on sequence public.notification_queue_id_seq from anon, authenticated;

-- 3. Helpers
create or replace function public.notify_window(p_event text) returns interval
  language sql immutable set search_path = public
  as $$ select case p_event when 'slide_sent' then interval '3 minutes' when 'slide_revised' then interval '3 minutes'
                            when 'assignment_changed' then interval '1 minute' else interval '5 minutes' end $$;

-- Adds one row; joins the open group of the same key (same send_after) or starts a new one.
create or replace function public.notify_enqueue(p_event text, p_recipient uuid, p_actor uuid, p_order_key text,
                                                 p_payload jsonb, p_group_extra text default null) returns void
  language plpgsql security definer set search_path = public
as $$
declare gk text; sa timestamptz; nm text;
begin
  if p_recipient is null or coalesce(p_order_key, '') = '' then return; end if;
  if p_actor is not null and p_actor = p_recipient then return; end if;          -- never about your own action
  gk := concat_ws('|', p_recipient::text, p_order_key, p_event, p_group_extra);
  perform pg_advisory_xact_lock(hashtext(gk));                                    -- one send_after per group
  select q.send_after into sa from public.notification_queue q
   where q.group_key = gk and q.sent_at is null and q.claimed_at is null order by q.id limit 1;
  select p.name into nm from public.profiles p where p.user_id = p_actor;
  insert into public.notification_queue (event, recipient_id, actor_id, actor_name, order_key, payload, group_key, send_after)
  values (p_event, p_recipient, p_actor, nm, p_order_key, coalesce(p_payload, '{}'), gk, coalesce(sa, now() + public.notify_window(p_event)));
end $$;

-- 4. Triggers. Each one is wrapped so that a notification problem can never fail the user's write.
create or replace function public.notify_slide_shots() returns trigger
  language plpgsql security definer set search_path = public
as $$
declare ok text := regexp_replace(new.project, '\D', '', 'g'); actor uuid := coalesce(auth.uid(), new.designer_id);
        prev text; dm uuid; ev text;
begin
  begin
    if tg_op = 'INSERT' then
      if new.team is null then return new; end if;
      ev := case when new.version > 1 then 'slide_revised' else 'slide_sent' end;
      if new.version > 1 then
        select s.status into prev from public.slide_shots s
         where s.file_key = new.file_key and s.slide_id = new.slide_id and s.version = new.version - 1 limit 1;
      end if;
      for dm in select d.user_id from public.design_managers d join public.profiles p on p.user_id = d.user_id
                 where p.team = new.team loop                                    -- tag team: own team's DMs only
        perform public.notify_enqueue(ev, dm, actor, ok,
          jsonb_build_object('shot_id', new.id, 'slide_number', new.slide_number, 'version', new.version,
                             'designer', new.designer, 'team', new.team, 'prev_status', prev,
                             'alternative_of', new.alternative_of),
          coalesce(new.designer_id::text, new.designer));
      end loop;
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('changes', 'approved') then
      perform public.notify_enqueue(case new.status when 'changes' then 'changes_requested' else 'approved' end,
        new.designer_id, auth.uid(), ok,
        jsonb_build_object('shot_id', new.id, 'slide_number', new.slide_number, 'version', new.version,
                           'reviewer', new.reviewed_by, 'alternative_of', new.alternative_of));
    end if;
  exception when others then
    raise warning 'notify_slide_shots: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_slide_shots on public.slide_shots;
create trigger notify_slide_shots after insert or update of status on public.slide_shots
  for each row execute function public.notify_slide_shots();

-- The assign dialog deletes the order's rows and inserts new ones, so one save can produce a delete and an
-- insert for the same person. The sender nets them out: "before" of the group's first row, "after" of its last.
create or replace function public.notify_slide_assignments() returns trigger
  language plpgsql security definer set search_path = public
as $$
declare ok text;
begin
  begin
    if tg_op = 'DELETE' then ok := regexp_replace(coalesce(old.order_name, old.order_key), '\D', '', 'g');
    else ok := regexp_replace(coalesce(new.order_name, new.order_key), '\D', '', 'g'); end if;
    if tg_op = 'INSERT' then
      perform public.notify_enqueue('assignment_changed', new.assignee_id, auth.uid(), ok,
        jsonb_build_object('before', null, 'after', to_jsonb(new.slides)));
    elsif tg_op = 'DELETE' then
      perform public.notify_enqueue('assignment_changed', old.assignee_id, auth.uid(), ok,
        jsonb_build_object('before', to_jsonb(old.slides), 'after', null));
    elsif new.assignee_id is distinct from old.assignee_id then
      perform public.notify_enqueue('assignment_changed', old.assignee_id, auth.uid(), ok,
        jsonb_build_object('before', to_jsonb(old.slides), 'after', null));
      perform public.notify_enqueue('assignment_changed', new.assignee_id, auth.uid(), ok,
        jsonb_build_object('before', null, 'after', to_jsonb(new.slides)));
    elsif new.slides is distinct from old.slides then
      perform public.notify_enqueue('assignment_changed', new.assignee_id, auth.uid(), ok,
        jsonb_build_object('before', to_jsonb(old.slides), 'after', to_jsonb(new.slides)));
    end if;
  exception when others then
    raise warning 'notify_slide_assignments: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists notify_slide_assignments on public.slide_assignments;
create trigger notify_slide_assignments after insert or update or delete on public.slide_assignments
  for each row execute function public.notify_slide_assignments();

-- 5. RPCs for the sender (service role only)
-- Claims every row of the groups that are due. Rows stay claimed for 5 minutes; a crashed run is retried after that.
create or replace function public.notify_claim(p_groups int default 100) returns setof public.notification_queue
  language plpgsql security definer set search_path = public
as $$
begin
  delete from public.notification_queue where sent_at < now() - interval '30 days';   -- housekeeping
  return query
  with due as (
    select distinct q.group_key from public.notification_queue q
     where q.sent_at is null and q.attempts < 5 and q.send_after <= now()
       and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
     limit p_groups),
  rows as (
    select q.id from public.notification_queue q join due using (group_key)
     where q.sent_at is null and q.attempts < 5
       and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
     for update of q skip locked)
  update public.notification_queue q set claimed_at = now() from rows where q.id = rows.id returning q.*;
end $$;

create or replace function public.notify_done(p_ids bigint[], p_message text) returns void
  language sql security definer set search_path = public
  as $$ update public.notification_queue set sent_at = now(), message = p_message, claimed_at = null, last_error = null
         where id = any(p_ids) $$;

-- Retry after 1, 5, 15, 15 minutes; after 5 attempts the rows stay with last_error and are not claimed again.
create or replace function public.notify_failed(p_ids bigint[], p_error text) returns void
  language sql security definer set search_path = public
  as $$ update public.notification_queue
           set attempts = attempts + 1, claimed_at = null, last_error = left(p_error, 500),
               send_after = now() + case attempts when 0 then interval '1 minute' when 1 then interval '5 minutes' else interval '15 minutes' end
         where id = any(p_ids) $$;

-- Names, teams, Slack ids and emails of the people a message is for or about.
create or replace function public.notify_people(p_ids uuid[]) returns table (user_id uuid, name text, team text, slack_user_id text, email text)
  language sql stable security definer set search_path = public
  as $$ select u.id, p.name, p.team,
               coalesce(p.slack_user_id, (select coalesce(i.identity_data->>'https://slack.com/user_id', i.identity_data->>'sub')
                                            from auth.identities i where i.user_id = u.id and i.provider = 'slack_oidc' limit 1)),
               u.email::text
          from auth.users u left join public.profiles p on p.user_id = u.id
         where u.id = any(p_ids) $$;

revoke execute on function public.notify_enqueue(text, uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.notify_claim(int)                from public, anon, authenticated;
revoke execute on function public.notify_done(bigint[], text)      from public, anon, authenticated;
revoke execute on function public.notify_failed(bigint[], text)    from public, anon, authenticated;
revoke execute on function public.notify_people(uuid[])            from public, anon, authenticated;
grant  execute on function public.notify_claim(int)                to service_role;
grant  execute on function public.notify_done(bigint[], text)      to service_role;
grant  execute on function public.notify_failed(bigint[], text)    to service_role;
grant  execute on function public.notify_people(uuid[])            to service_role;

-- To look at the queue:  select id, event, order_key, send_after, sent_at, message, attempts, last_error
--                          from public.notification_queue order by id desc limit 50;
-- Undo: drop trigger notify_slide_shots on public.slide_shots; drop trigger notify_slide_assignments on public.slide_assignments;
--       drop table public.notification_queue;  (the slack_user_id column on profiles can stay)

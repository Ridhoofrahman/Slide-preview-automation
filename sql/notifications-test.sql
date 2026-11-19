-- Slack notifications: test on one DM account with a fake order #999001 (run in the SQL Editor).
-- Replace YOUR_EMAIL below with the email of a DM account that has a team. Run part 1, wait 5 minutes,
-- run part 2 to read the messages, then part 3 to remove everything again.
-- In the SQL Editor there is no signed-in user, so the "actor" is empty: messages say "Someone" or the reviewer name.

-- Part 1: create the test events
do $$
declare me uuid; tm text;
begin
  select u.id, p.team into me, tm
    from auth.users u join public.profiles p on p.user_id = u.id join public.design_managers d on d.user_id = u.id
   where lower(u.email) = lower('YOUR_EMAIL') and p.team is not null;
  if me is null then raise exception 'No DM with a team for that email'; end if;

  -- a) you are assigned slides 1-5 (designer message, 1 min)
  insert into public.slide_assignments (order_key, order_name, assignee_id, assignee_name, assignee_team, slides, created_by)
  values ('999001', 'Order #999001', me, 'Test', tm, '{1,2,3,4,5}', 'Test');

  -- b) a test designer of your team sends slides 1-5 (DM message, 3 min, one message for all five)
  insert into public.slide_shots (file_key, project, slide_id, slide_number, total_slides, designer, designer_id, team, image_path)
  select 'test-999001', 'Order #999001', 'test-' || n, n, 7, 'Test designer', null, tm, 'test/none.png' from generate_series(1, 5) n;

  -- c) your own slides 6 and 7 get "changes requested" (designer message, 5 min). Sending them yourself tells nobody.
  insert into public.slide_shots (file_key, project, slide_id, slide_number, total_slides, designer, designer_id, team, image_path)
  select 'test-999001-mine', 'Order #999001', 'mine-' || n, n, 7, 'You', me, tm, 'test/none.png' from generate_series(6, 7) n;
  update public.slide_shots set status = 'changes', reviewed_by = 'Test DM', reviewed_at = now() where file_key = 'test-999001-mine';
end $$;

-- Part 2: what was queued and what was (or would be) sent
-- select event, send_after, sent_at, message, attempts, last_error from public.notification_queue
--  where order_key = '999001' order by id;

-- Part 3: clean up (the distribution first, then the queue, so the clean-up itself sends nothing)
-- delete from public.slide_shots where project = 'Order #999001';
-- delete from public.slide_assignments where order_key = '999001';
-- delete from public.notification_queue where order_key = '999001';

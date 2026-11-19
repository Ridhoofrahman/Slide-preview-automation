-- Alternative slides (panel v2.42): a designer can send an extra slide as an alternative of one of their assigned slides.
-- alternative_of = the slide number it is an alternative of (null = a normal slide). Alternative rows keep
-- slide_number = that same number so they sort next to it; every position and progress count skips them.
-- Run once in the SQL Editor (safe to run again). Nothing existing changes: all current rows stay normal slides.
-- Needs sql/notifications.sql first (the Slack trigger below is that file's function with alternative_of added).

alter table public.slide_shots add column if not exists alternative_of int;

-- Slack notifications: pass alternative_of to the sender so it can say "an alternative of slide 1"
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

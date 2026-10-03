-- Event planning, reminders: the weekly email with the week's tasks and payments (a host's choice, on by
-- default once they set the plan up). Same rules as the rest: SECURITY DEFINER, empty search_path,
-- service_role only. The daily run asks who is due (the database holds the dedupe: a plan is reminded
-- at most once in six days, however many times the run is called) and records each one it emailed.

-- The plans to remind now (at most 200 a run): the host chose the weekly email, the plan is set up, the
-- invitation is live (not archived, not a save-the-date), the event is not long past, the owner has an
-- email and an active account, and it has been six days since the last reminder.
create function public.planning_reminders_due(p_now timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'ownerId', i.owner_id, 'email', u.email,
    'locales', i.draft -> 'locales', 'defaultLocale', i.draft ->> 'defaultLocale', 'hosts', i.draft -> 'hosts'
  ) order by due.sent_at nulls first), '[]'::jsonb)
  from (
    select s.invitation_id, s.reminder_sent_at as sent_at
    from public.plan_settings s
    where s.onboarding_done
      and coalesce((s.reminders ->> 'email')::boolean, false)
      and (s.reminder_sent_at is null or s.reminder_sent_at < p_now - interval '6 days')
    order by s.reminder_sent_at nulls first
    limit 200
  ) due
  join public.invitations i on i.id = due.invitation_id
  join auth.users u on u.id = i.owner_id
  where i.status <> 'archived'
    and i.event_type <> 'save_the_date'
    and u.email is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until < p_now)
    -- an event more than a day past gets no more reminders
    and (
      (i.draft #>> '{event,date}') !~ '^\d{4}-\d{2}-\d{2}$'
      or (i.draft #>> '{event,date}') >= to_char((p_now - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD')
    )
$$;

-- Records that a plan was looked at for a reminder (emailed, or had nothing due this week).
create function public.planning_reminder_sent(p_id uuid, p_at timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.plan_settings set reminder_sent_at = p_at where invitation_id = p_id;
  return found;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.planning_reminders_due(timestamptz)',
    'public.planning_reminder_sent(uuid, timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

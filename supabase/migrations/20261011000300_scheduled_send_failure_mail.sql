-- A scheduled send that didn't go out (features/scheduler): its host gets an email — what it was, when
-- it was for (on the clock they picked), why it didn't go out, and the way to send it again. Every
-- failed send counts: one the app found it couldn't send (no credits, the album off…) and one whose run
-- never finished (scheduled_send_claim: 'timeout'). Once per send (failure_mailed_at); an email that
-- couldn't go is tried again on the clock's next turn, for two days.
--
-- Same rules as the rest of the app: service_role only. Additive only.

alter table public.scheduled_sends add column failure_mailed_at timestamptz;
create index scheduled_sends_failed_unmailed on public.scheduled_sends (finished_at)
  where status = 'failed' and failure_mailed_at is null;

-- The failed sends whose host wasn't told yet (finished in the last two days), with what the email
-- needs: the owner's address, the invitation's slug and document (its names and host language).
create function public.scheduled_send_failures(p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.scheduled_send_json(s) || jsonb_build_object(
      'ownerEmail', u.email,
      'slug', i.slug,
      'document', coalesce(i.published, i.draft)
    ) order by s.finished_at), '[]'::jsonb)
  from (
    select * from public.scheduled_sends
    where status = 'failed' and failure_mailed_at is null and finished_at > now() - interval '2 days'
    order by finished_at
    limit least(greatest(p_limit, 1), 50)
  ) s
  join public.invitations i on i.id = s.invitation_id
  join auth.users u on u.id = s.owner_id
$$;

-- The host was told (once). false when they already were.
create function public.scheduled_send_failure_mailed(p_send uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.scheduled_sends set failure_mailed_at = now()
  where id = p_send and status = 'failed' and failure_mailed_at is null;
  return found;
end $$;

revoke all on function public.scheduled_send_failures(int) from public, anon, authenticated;
revoke all on function public.scheduled_send_failure_mailed(uuid) from public, anon, authenticated;
grant execute on function public.scheduled_send_failures(int) to service_role;
grant execute on function public.scheduled_send_failure_mailed(uuid) to service_role;

-- A scheduled send that didn't go out (features/scheduler): besides the email, its host gets a
-- WhatsApp message from the system's number — the host alert template (docs/whatsapp-setup.md §14), to
-- the phone on their account (accounts.phone). Once per send (failure_whatsapp_at, and how it went:
-- sent, failed, or skipped — no phone, a landline, they asked not to get WhatsApp messages); a send
-- WhatsApp couldn't take now is tried again on the clock's next turn, for two days. No credit: it is
-- the system telling the host, not a message to guests.
--
-- Same rules as the rest of the app: service_role only. Additive only.

alter table public.scheduled_sends
  add column failure_whatsapp_at timestamptz,
  add column failure_whatsapp text check (failure_whatsapp is null or failure_whatsapp in ('sent', 'failed', 'skipped'));
create index scheduled_sends_failed_unalerted on public.scheduled_sends (finished_at)
  where status = 'failed' and failure_whatsapp_at is null;

-- The failed sends whose host wasn't sent the WhatsApp alert yet (finished in the last two days), with
-- what it needs: the phone on the owner's account and whether the system's number may write to it, the
-- invitation's document (its host language).
create function public.scheduled_send_failure_alerts(p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.scheduled_send_json(s) || jsonb_build_object(
      'ownerPhone', a.phone,
      'reach', case
        when a.phone is null or a.phone = '' then 'none'
        when not public.whatsapp_capable(a.phone) then 'landline'
        when exists (select 1 from public.whatsapp_opt_outs o where o.phone = a.phone) then 'opted_out'
        else 'ok' end,
      'document', coalesce(i.published, i.draft)
    ) order by s.finished_at), '[]'::jsonb)
  from (
    select * from public.scheduled_sends
    where status = 'failed' and failure_whatsapp_at is null and finished_at > now() - interval '2 days'
    order by finished_at
    limit least(greatest(p_limit, 1), 50)
  ) s
  join public.invitations i on i.id = s.invitation_id
  left join public.accounts a on a.user_id = s.owner_id
$$;

-- How the alert went ('sent' | 'failed' | 'skipped'), once. false when it was already recorded.
create function public.scheduled_send_failure_alerted(p_send uuid, p_outcome text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.scheduled_sends set failure_whatsapp_at = now(), failure_whatsapp = p_outcome
  where id = p_send and status = 'failed' and failure_whatsapp_at is null
    and p_outcome in ('sent', 'failed', 'skipped');
  return found;
end $$;

revoke all on function public.scheduled_send_failure_alerts(int) from public, anon, authenticated;
revoke all on function public.scheduled_send_failure_alerted(uuid, text) from public, anon, authenticated;
grant execute on function public.scheduled_send_failure_alerts(int) to service_role;
grant execute on function public.scheduled_send_failure_alerted(uuid, text) to service_role;

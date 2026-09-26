-- The gallery link in the guest's language (the rule of the invitation and the table number,
-- supabase/migrations/*_event_day_languages.sql): the WhatsApp message with a guest's gallery link is
-- written in their language when the gallery's template is approved in it, else in the invitation's
-- (src/features/live-gallery/server/notify.ts), and its button opens the gallery in their language.
-- The sender's claim returns the guest's language besides what it returned: the same definition
-- otherwise (copied from *_gallery_link.sql), the same signature — create or replace keeps its grants,
-- restated below. Additive: nothing else changes, no data moves.

-- ─── the gallery links the sender claims: + the guest's language ───────────────────────────────

create or replace function public.gallery_notice_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_msg uuid;
begin
  for v_msg in
    select n.id from public.gallery_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.gallery_notice_result(v_msg, null, 'timeout');
  end loop;
  for v_msg in
    select n.id from public.gallery_notices n
    where (p_id is null or n.invitation_id = p_id) and n.status = 'queued'
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = n.to_phone)
    for update skip locked
  loop
    update public.gallery_notices set status = 'sending', claimed_at = now() where id = v_msg;
    perform public.gallery_notice_result(v_msg, null, 'opted_out');
  end loop;
  with picked as (
    select n.id from public.gallery_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'queued' and (n.next_attempt_at is null or n.next_attempt_at <= now())
    order by coalesce(n.next_attempt_at, n.created_at), n.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.gallery_notices n set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'invitationId', c.invitation_id,
      'toPhone', c.to_phone,
      'attempts', c.attempts,
      'guestName', g.name,
      'guestToken', g.token,
      'guestLanguage', g.preferred_language,
      'slug', i.slug,
      'document', coalesce(i.published, i.draft),
      'uploadTokenHash', ga.upload_token_hash,
      'uploadTokenNonce', ga.upload_token_nonce
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id
  left join public.galleries ga on ga.invitation_id = c.invitation_id;
  return v;
end $$;

-- ─── privileges: service_role only (as before) ─────────────────────────────────────────────────

revoke all on function public.gallery_notice_claim(uuid, int) from public, anon, authenticated;
grant execute on function public.gallery_notice_claim(uuid, int) to service_role;

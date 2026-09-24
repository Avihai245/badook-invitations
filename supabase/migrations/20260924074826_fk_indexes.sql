-- Covering indexes for the foreign keys the database advisor flagged: deleting an account (which
-- cascades through these tables) and the lookups by these columns no longer scan whole tables.
create index if not exists billing_events_user_id_idx on public.billing_events (user_id);
create index if not exists contact_messages_user_id_idx on public.contact_messages (user_id);
create index if not exists invitations_template_id_idx on public.invitations (template_id);
create index if not exists whatsapp_messages_guest_id_idx on public.whatsapp_messages (guest_id);
create index if not exists whatsapp_messages_owner_id_idx on public.whatsapp_messages (owner_id);

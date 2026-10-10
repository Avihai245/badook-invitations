-- AI photos in any look (feature ai_photos): next to a real photo, guests pick a style with a tap — an
-- animated film, a watercolor, an oil painting, a movie poster, a vintage photo
-- (features/ai-photos/model.ts STYLES). The photo keeps its style for the worker that makes it, and the
-- pages get it. Additive only; the functions are as before, plus the style.

alter table public.ai_photos add column style text not null default 'photo'
  check (style in ('photo', 'cartoon', 'watercolor', 'painting', 'poster', 'vintage'));

create or replace function public.ai_photo_json(p public.ai_photos) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'error', p.error,
    'prompt', p.prompt,
    'style', p.style,
    'people', to_jsonb(p.people),
    'locale', p.locale,
    'guestName', p.guest_name,
    'guestId', p.guest_id,
    'sourcePath', p.source_path,
    'resultPath', p.result_path,
    'thumbPath', p.thumb_path,
    'width', p.width,
    'height', p.height,
    'externalId', p.external_id,
    'attempts', p.attempts,
    'galleryItemId', p.gallery_item_id,
    'createdAt', p.created_at,
    'finishedAt', p.finished_at
  )
$$;

-- A guest asks for a photo (as before): also its style (p_photo.style; absent: a real photo).
create or replace function public.ai_photo_create(
  p_invitation_id uuid, p_uploader_hash text, p_guest_id uuid, p_name text, p_photo jsonb, p_daily_limit int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.ai_photo_settings;
  v_people uuid[];
  v_counts jsonb;
  v_guest uuid := p_guest_id;
begin
  select * into s from public.ai_photo_settings where invitation_id = p_invitation_id for update;
  if not found or not s.enabled then
    return jsonb_build_object('ok', false, 'code', 'off');
  end if;
  select coalesce(array_agg(p.id order by p.seq), '{}') into v_people
  from public.ai_photo_people p
  where p.invitation_id = p_invitation_id and p.photo_path is not null
    and p.id in (select (e #>> '{}')::uuid from jsonb_array_elements(coalesce(p_photo->'people', '[]')) e);
  if cardinality(v_people) = 0 then
    return jsonb_build_object('ok', false, 'code', 'no_people');
  end if;
  v_counts := public.ai_photo_counts(p_invitation_id, p_uploader_hash);
  if (v_counts->>'guest')::int >= s.per_guest then
    return jsonb_build_object('ok', false, 'code', 'guest_limit', 'limit', s.per_guest);
  end if;
  if (v_counts->>'event')::int >= s.per_event then
    return jsonb_build_object('ok', false, 'code', 'event_limit');
  end if;
  if (select count(*) from public.ai_photos
      where created_at > now() - interval '1 day' and status not in ('failed', 'blocked')) >= p_daily_limit then
    return jsonb_build_object('ok', false, 'code', 'daily_limit');
  end if;
  if v_guest is not null and not exists (
    select 1 from public.invitation_guests where id = v_guest and invitation_id = p_invitation_id
  ) then
    v_guest := null;
  end if;
  insert into public.ai_photos (
    id, invitation_id, uploader_hash, guest_id, guest_name, prompt, style, people, locale, source_path
  ) values (
    (p_photo->>'id')::uuid, p_invitation_id, p_uploader_hash, v_guest, nullif(btrim(p_name), ''),
    p_photo->>'prompt', coalesce(p_photo->>'style', 'photo'), v_people, p_photo->>'locale', p_photo->>'sourcePath'
  );
  return jsonb_build_object('ok', true, 'left', s.per_guest - (v_counts->>'guest')::int - 1);
end $$;

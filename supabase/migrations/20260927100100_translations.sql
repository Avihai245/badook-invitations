-- Machine translations of an invitation's texts and their review (feature translate_ai,
-- src/features/invitations/translate): one row per language and text (`path`, stable across section
-- reorders — translate/fields.ts), with the text it was made from (`source_locale`, `source_hash`) so
-- a change to the source marks it stale. The translation itself is written into the draft; these rows
-- say which texts are still the machine's (status auto), which the host approved, and which went
-- stale. Publishing waits while a language of the invitation has machine text the host hasn't
-- approved. Plus the invitation's glossary (words never translated: names, places, brands) and the
-- runs, for the per-owner rate limit. Same rules as the rest: row level security on with no
-- policies, service_role only, every function checks the owner.

create table public.translations (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  locale text not null check (locale in ('he', 'en', 'ru', 'ar', 'fr', 'es', 'am')),
  path text not null check (char_length(path) between 1 and 200),
  source_locale text not null check (source_locale in ('he', 'en', 'ru', 'ar', 'fr', 'es', 'am')),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{16,64}$'),
  text text not null check (char_length(text) <= 4000),
  status text not null default 'auto' check (status in ('auto', 'approved', 'stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (locale <> source_locale)
);
-- one current row per language and text (a discarded one stays until the invitation goes)
create unique index translations_current on public.translations (invitation_id, locale, path)
  where deleted_at is null;
create trigger translations_touch before update on public.translations
  for each row execute function public.touch_updated_at();

create table public.translation_glossaries (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  terms text[] not null default '{}' check (cardinality(terms) <= 100),
  updated_at timestamptz not null default now()
);
create trigger translation_glossaries_touch before update on public.translation_glossaries
  for each row execute function public.touch_updated_at();

create table public.translation_runs (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  locale text not null check (locale in ('he', 'en', 'ru', 'ar', 'fr', 'es', 'am')),
  created_at timestamptz not null default now()
);
create index on public.translation_runs (owner_id, created_at desc);
create index on public.translation_runs (invitation_id);

alter table public.translations enable row level security;
alter table public.translation_glossaries enable row level security;
alter table public.translation_runs enable row level security;
revoke all on public.translations, public.translation_glossaries, public.translation_runs
  from anon, authenticated;

-- ─── functions ──────────────────────────────────────────────────────────────────────────────────

create function public.translation_json(t public.translations) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'locale', t.locale,
    'path', t.path,
    'sourceLocale', t.source_locale,
    'sourceHash', t.source_hash,
    'text', t.text,
    'status', t.status,
    'updatedAt', t.updated_at
  )
$$;

-- An invitation's current translations and glossary: { rows, glossary }, or null when it isn't the
-- owner's.
create function public.translations_list(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(public.translation_json(t) order by t.locale, t.path)
      from public.translations t
      where t.invitation_id = p_id and t.deleted_at is null
    ), '[]'::jsonb),
    'glossary', coalesce((
      select to_jsonb(g.terms) from public.translation_glossaries g where g.invitation_id = p_id
    ), '[]'::jsonb)
  );
end $$;

-- Records translations — a machine run's (status auto), or the host's approval of what the machine
-- wrote (status approved, with the source it was approved against) — one per language and path,
-- replacing the current one. p_rows: [{ locale, path, sourceLocale, sourceHash, text, status }], at
-- most 500. Returns how many, or null when the invitation isn't the owner's.
create function public.translations_save(p_id uuid, p_owner_id uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'translations_save: bad rows' using errcode = 'P0001';
  end if;
  insert into public.translations as t (invitation_id, locale, path, source_locale, source_hash, text, status)
  select p_id, r.locale, r.path, r."sourceLocale", r."sourceHash", r.text,
         case when r.status = 'approved' then 'approved' else 'auto' end
  from jsonb_to_recordset(p_rows) as r(
    locale text, path text, "sourceLocale" text, "sourceHash" text, text text, status text
  )
  on conflict (invitation_id, locale, path) where deleted_at is null do update set
    source_locale = excluded.source_locale,
    source_hash = excluded.source_hash,
    text = excluded.text,
    status = excluded.status;
  get diagnostics n = row_count;
  return n;
end $$;

-- The source of these translations changed since they were made (the server compares the hashes):
-- they go back to review. Returns how many, or null.
create function public.translations_mark_stale(p_id uuid, p_owner_id uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  update public.translations set status = 'stale'
  where invitation_id = p_id and id = any(p_ids) and deleted_at is null and status <> 'stale';
  get diagnostics n = row_count;
  return n;
end $$;

-- Drops translations that no longer apply (a language removed, a text the host rewrote or deleted):
-- the given paths of one language, or all of it (p_paths null). Returns how many, or null.
create function public.translations_discard(p_id uuid, p_owner_id uuid, p_locale text, p_paths text[])
returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  update public.translations set deleted_at = now()
  where invitation_id = p_id and locale = p_locale and deleted_at is null
    and (p_paths is null or path = any(p_paths));
  get diagnostics n = row_count;
  return n;
end $$;

-- The invitation's glossary: words the translation keeps as they are (at most 100, each 1–80
-- characters, trimmed, once). Returns the stored list, or null.
create function public.translation_glossary_set(p_id uuid, p_owner_id uuid, p_terms text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v text[];
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  select coalesce(array_agg(t order by ord), '{}') into v
  from (
    select distinct on (btrim(x)) btrim(x) as t, ord
    from unnest(coalesce(p_terms, '{}')) with ordinality as u(x, ord)
    where btrim(x) <> ''
    order by btrim(x), ord
  ) s;
  if cardinality(v) > 100 or exists (select 1 from unnest(v) t where char_length(t) > 80) then
    raise exception 'translation_glossary_set: too long' using errcode = 'P0001';
  end if;
  insert into public.translation_glossaries (invitation_id, terms) values (p_id, v)
  on conflict (invitation_id) do update set terms = excluded.terms;
  return to_jsonb(v);
end $$;

-- A machine translation run is about to start: true (and recorded) while the owner stays within
-- p_limit runs in p_window_seconds, false past it, null when the invitation isn't theirs. Runs older
-- than two days are dropped here.
create function public.translation_run_begin(
  p_id uuid, p_owner_id uuid, p_locale text, p_limit int, p_window_seconds int
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  delete from public.translation_runs where owner_id = p_owner_id and created_at < now() - interval '2 days';
  select count(*) into n from public.translation_runs
  where owner_id = p_owner_id and created_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_limit then
    return false;
  end if;
  insert into public.translation_runs (owner_id, invitation_id, locale) values (p_owner_id, p_id, p_locale);
  return true;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.translation_json(public.translations)',
    'public.translations_list(uuid, uuid)',
    'public.translations_save(uuid, uuid, jsonb)',
    'public.translations_mark_stale(uuid, uuid, uuid[])',
    'public.translations_discard(uuid, uuid, text, text[])',
    'public.translation_glossary_set(uuid, uuid, text[])',
    'public.translation_run_begin(uuid, uuid, text, int, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

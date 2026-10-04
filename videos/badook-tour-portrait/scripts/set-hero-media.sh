#!/usr/bin/env bash
# hero.sh '<media json>' — sets the demo invitation's hero media (draft + published)
M="$1"
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d badook_local -v ON_ERROR_STOP=1 -v m="$M" <<'SQL'
update invitations i set
  draft = jsonb_set(draft, '{sections}', (select jsonb_agg(case when s->>'type' = 'hero' then jsonb_set(s, '{data,media}', :'m'::jsonb) else s end order by o) from jsonb_array_elements(i.draft->'sections') with ordinality x(s, o))),
  published = jsonb_set(published, '{sections}', (select jsonb_agg(case when s->>'type' = 'hero' then jsonb_set(s, '{data,media}', :'m'::jsonb) else s end order by o) from jsonb_array_elements(i.published->'sections') with ordinality x(s, o))),
  updated_at = now()
where id = 'c68c616a-f8b5-4d88-910b-a6aae1a986e1';
SQL

-- Raid Forge schema (optional — only needed if you want shared/persistent rosters).
-- Run this once against your Neon database, e.g. from the Neon SQL Editor,
-- or with:  psql "$DATABASE_URL" -f db/schema.sql

create table if not exists roster_snapshots (
  -- Short, URL-safe id used by the app (e.g. "my-guild")
  id          text primary key,
  -- Whole roster serialized as JSON: { members: RosterMember[], raidSize: number }
  data        jsonb not null,
  -- Optional write token. Leave null for a public edit link, or set it to
  -- require the matching value in the `x-roster-token` header to write.
  write_token text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keep updated_at honest on every write.
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists roster_snapshots_touch on roster_snapshots;
create trigger roster_snapshots_touch
  before update on roster_snapshots
  for each row execute function touch_updated_at();

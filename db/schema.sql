-- Reports of ICE activity. Coordinates are rounded (~100 m) before they are stored.
CREATE TABLE IF NOT EXISTS reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL CHECK (category IN ('vehicle', 'agents', 'checkpoint', 'detention', 'other')),
  description  text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  lat          double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng          double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  observed_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source       text NOT NULL DEFAULT 'community' CHECK (source IN ('community', 'moderator')),
  reviewed_at  timestamptz,
  -- Salted SHA-256 of the submitter's IP, used only for rate limiting. Raw IPs are never stored.
  ip_hash      text
);

CREATE INDEX IF NOT EXISTS reports_status_observed_idx ON reports (status, observed_at DESC);
CREATE INDEX IF NOT EXISTS reports_ip_created_idx ON reports (ip_hash, created_at DESC);

-- Reports imported from other trackers (StopICE, iceout.org, news), with attribution.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS verification text
  CHECK (verification IN ('confirmed', 'sighting', 'unconfirmed', 'prior'));
-- Stable key per imported incident so re-running the import never duplicates it.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS reports_external_id_idx ON reports (external_id);
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_source_check;
ALTER TABLE reports ADD CONSTRAINT reports_source_check CHECK (source IN ('community', 'moderator', 'imported'));

-- Incidents that belong together (e.g. an arrest and the hospital where the person was taken) share a key.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS related_key text;
CREATE INDEX IF NOT EXISTS reports_related_key_idx ON reports (related_key);

-- True when the pin is a best guess (only a city, ZIP or street was given). The map labels these.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS location_approximate boolean NOT NULL DEFAULT false;

-- How many reports this pin stands for (merged reports from the same place and time). The map glows brighter
-- for higher counts.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 1 CHECK (report_count >= 1);

-- Alerts the hourly sync looked at and deliberately left out (outside the Bay Area, duplicates), so it
-- doesn't re-check them every run.
CREATE TABLE IF NOT EXISTS import_skips (
  external_id text PRIMARY KEY,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- When each data job last ran (the hourly StopICE sync, manual imports). The map shows the latest.
CREATE TABLE IF NOT EXISTS sync_status (
  job         text PRIMARY KEY,
  last_run_at timestamptz NOT NULL,
  published   integer NOT NULL DEFAULT 0
);

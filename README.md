# ICE Watch Bay Area

A Next.js app that maps reported ICE activity in the Bay Area, pulled from community trackers (StopICE, People Over Papers, news) and labeled with each report's source. People are pointed to county rapid response hotlines to report activity. It uses Leaflet with an OpenFreeMap basemap, Neon Postgres for storage, and deploys to Vercel.

## How it works

- **Public map (`/`)**: shows approved reports from the last 2 hours to 30 days, colored by category. Pins fade over their first 3 days and older ones stay faint. Pins verified by a moderator get a dark outline, and reports imported from other trackers are labeled with their source and rating. The map refreshes every minute.
- **Reporting**: **How to report** lists the Bay Area county rapid response hotlines (`lib/hotlines.ts`), which verify reports and send legal observers. The public can't submit reports on the site.
- **Cleanup**: a daily Vercel Cron job deletes reports whose activity is older than `RETENTION_DAYS` (30 by default), plus rejected reports and pending ones that sat in the queue.

### Built-in privacy and safety measures

- Coordinates are rounded to about 110 m before they're saved, so exact addresses aren't published.
- The server rejects descriptions containing phone numbers, emails, links or mentions of license plates. The form also asks people not to identify anyone, agents included.
- Raw IP addresses are never stored. Rate limiting (5 reports per hour) uses a salted hash.
- Reports must be from the last 24 hours, and the public view only shows recent activity.
- Pages are marked `noindex` and the referrer is suppressed.

## Deploy to Vercel

1. Push this folder to a GitHub repo and import it in Vercel.
2. In the Vercel project, go to **Storage → Create → Neon** (Marketplace). This adds `DATABASE_URL` for you.
3. Under **Settings → Environment Variables**, add:
   - `CRON_SECRET`: `openssl rand -hex 32` (Vercel sends this to the cleanup cron automatically)
   - Optional: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_MAP_CENTER` (defaults to Oakland), `NEXT_PUBLIC_MAP_ZOOM`, `NEXT_PUBLIC_HOTLINE_LABEL`, `NEXT_PUBLIC_HOTLINE_NUMBER`, `RETENTION_DAYS`
4. Create the table, either by running `db/schema.sql` in the Neon SQL editor or locally:
   ```bash
   npm install
   vercel link && vercel env pull .env.local
   npm run db:migrate
   ```
5. Redeploy. `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after you change them.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and CRON_SECRET
npm run db:migrate
npm run dev
```

## Importing reports from other trackers

`npm run db:import -- <file.json>` publishes reports gathered elsewhere (StopICE, iceout.org, news). Each row needs `external_id`, `category`, `description`, `lat`, `lng`, `observed_at`, `verification` (`confirmed`, `sighting`, `unconfirmed` or `prior`), `source_name` and `source_url`. Rows are keyed on `external_id`, so re-running an import never creates duplicates. Run `npm run db:migrate` first to add the columns.

## Sources

- **StopICE**: public data, synced hourly (see below).
- **People Over Papers (iceout.org)**: used with their permission (Instagram message, Oct 2026). Their site doesn't allow automated access, so their reports are imported by hand; ask them for a feed or API key to automate it. Their "Other" category (agencies without immigration authority) is left off the map.
- **News and Mission Local**: added by hand with links to the articles.

## Automatic updates

`.github/workflows/sync-reports.yml` runs `scripts/sync-stopice.mjs` every hour. It pulls recent Bay Area StopICE alerts, uses each alert page's original text (the export strips punctuation), removes plates, VINs, phone numbers and emails, checks the written location against OpenStreetMap, skips anything already on the map, and publishes the rest with their source link. Add these repository secrets under **Settings → Secrets and variables → Actions**:

- `DATABASE_URL`: the same Neon connection string Vercel uses
- `STOPICE_API_KEY` (optional): with it the sync uses StopICE's real-time API; without it, their nightly export

Test locally with `node --env-file-if-exists=.env.local scripts/sync-stopice.mjs --dry-run`.

## Project layout

```
app/
  page.tsx                    map page
  api/reports/                GET reports for a time window
  api/cron/cleanup/           daily retention cleanup
components/MapApp.tsx         page shell, filters, polling
components/MapView.tsx        Leaflet map (client-only)
components/ReportHelp.tsx     how to report (county hotlines, StopICE)
lib/                          db client, types, themes, hotlines
scripts/                      migrate, import, hourly StopICE sync
db/schema.sql                 table + indexes
```

## Before going public

- **Basemap**: tiles come from [OpenFreeMap](https://openfreemap.org), which is free and needs no API key.
- **Legal**: recording and reporting law enforcement activity in public is generally protected, but don't publish anything that identifies officers or anyone else, and get advice from a local legal group before launching widely.

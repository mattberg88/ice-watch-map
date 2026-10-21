# Community Watch Map

A Next.js app for mapping reported ICE activity. Anyone can submit a sighting. Moderators approve it before it appears, and moderators can also publish verified reports directly. It uses Leaflet + OpenStreetMap for the map and Neon Postgres for storage, and deploys to Vercel.

## How it works

- **Public map (`/`)**: shows approved reports from the last 2 hours to 30 days, colored by category. Pins fade over their first 3 days and older ones stay faint. Pins verified by a moderator get a dark outline, and reports imported from other trackers are labeled with their source and rating. The map refreshes every minute.
- **Submitting**: tap **+ Report**, then tap the map or use **Use my location**, pick a category and time, and add optional details. Community reports go into a pending queue.
- **Moderation (`/admin`)**: log in with the password, then approve, reject, unpublish or delete reports. While you're logged in, reports you submit from the map are published right away as "verified."
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
   - `ADMIN_PASSWORD`: a long random password for moderators
   - `SESSION_SECRET`: `openssl rand -hex 32`
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
cp .env.example .env.local   # fill in DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm run db:migrate
npm run dev
```

## Importing reports from other trackers

`npm run db:import -- <file.json>` publishes reports gathered elsewhere (StopICE, iceout.org, news). Each row needs `external_id`, `category`, `description`, `lat`, `lng`, `observed_at`, `verification` (`confirmed`, `sighting`, `unconfirmed` or `prior`), `source_name` and `source_url`. Rows are keyed on `external_id`, so re-running an import never creates duplicates. Run `npm run db:migrate` first to add the columns.

## Project layout

```
app/
  page.tsx                    map page
  admin/page.tsx              moderation queue
  api/reports/                GET approved reports, POST new report
  api/admin/{login,logout,session}/
  api/admin/reports/          GET queue, PATCH/DELETE /:id
  api/cron/cleanup/           daily retention cleanup
components/MapApp.tsx         page shell, filters, polling
components/MapView.tsx        Leaflet map (client-only)
components/ReportForm.tsx     submission form
lib/                          db client, auth, validation, types
db/schema.sql                 table + indexes
```

## Before going public

- **Tile usage**: OpenStreetMap's public tile servers are fine for light use, but their [usage policy](https://operations.osmfoundation.org/policies/tiles/) prohibits heavy traffic. If the app takes off, switch the `TileLayer` URL to a provider such as MapTiler or Stadia.
- **Moderators**: there's one shared password. For a larger team, swap in real accounts (for example Auth.js or Clerk) so you can tell who approved what.
- **Spam**: if bots show up, add Cloudflare Turnstile or Vercel BotID to the report form.
- **Legal**: recording and reporting law enforcement activity in public is generally protected, but don't publish anything that identifies officers or anyone else, and get advice from a local legal group before launching widely.

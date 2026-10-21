// Publishes reports gathered from other trackers (see research/build_map.py).
// Usage: npm run db:import -- research/import.json   (reads .env.local if present)
// Each row: { external_id, category, description, lat, lng, observed_at, verification, source_name, source_url }
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const CATEGORIES = new Set(["vehicle", "agents", "checkpoint", "detention", "other"]);
const VERIFICATIONS = new Set(["confirmed", "sighting", "unconfirmed", "prior"]);

const url = process.env.DATABASE_URL;
const file = process.argv[2];
if (!url || !file) {
  console.error("Usage: npm run db:import -- <file.json>  (DATABASE_URL must be set)");
  process.exit(1);
}

const sql = neon(url);
const rows = JSON.parse(await readFile(file, "utf8"));
const round = (n) => Math.round(n * 1000) / 1000;

let inserted = 0;
let skipped = 0;
for (const r of rows) {
  if (!r.external_id || !CATEGORIES.has(r.category) || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) {
    skipped++;
    continue;
  }
  const verification = VERIFICATIONS.has(r.verification) ? r.verification : null;
  const sourceUrl = /^https?:\/\//i.test(r.source_url ?? "") ? r.source_url : null;
  const result = await sql`
    INSERT INTO reports (category, description, lat, lng, observed_at, status, source, reviewed_at,
                         source_name, source_url, verification, external_id)
    VALUES (${r.category}, ${String(r.description ?? "").slice(0, 500)}, ${round(r.lat)}, ${round(r.lng)},
            ${r.observed_at}, 'approved', 'imported', now(),
            ${String(r.source_name ?? "").slice(0, 120)}, ${sourceUrl}, ${verification}, ${r.external_id})
    ON CONFLICT (external_id) DO NOTHING
    RETURNING id
  `;
  result.length ? inserted++ : skipped++;
}
console.log(`Imported ${inserted} reports, skipped ${skipped} (already present or invalid).`);

// Publishes reports gathered from other trackers (see research/build_map.py).
// Usage: npm run db:import -- research/import.json [--prune]   (reads .env.local if present)
// --prune deletes previously imported reports that are no longer in the file.
// Each row: { external_id, category, description, lat, lng, observed_at, verification, source_name, source_url, related_key, location_approximate }
// Rows already imported are updated in place, so re-running picks up corrected text or new links.
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const CATEGORIES = new Set(["vehicle", "agents", "checkpoint", "detention", "other"]);
const VERIFICATIONS = new Set(["confirmed", "sighting", "unconfirmed", "prior"]);

const url = process.env.DATABASE_URL;
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const prune = process.argv.includes("--prune");
if (!url || !file) {
  console.error("Usage: npm run db:import -- <file.json>  (DATABASE_URL must be set)");
  process.exit(1);
}

const sql = neon(url);
const rows = JSON.parse(await readFile(file, "utf8"));
const round = (n) => Math.round(n * 1000) / 1000;

let inserted = 0;
let updated = 0;
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
                         source_name, source_url, verification, external_id, related_key, location_approximate)
    VALUES (${r.category}, ${String(r.description ?? "").slice(0, 500)}, ${round(r.lat)}, ${round(r.lng)},
            ${r.observed_at}, 'approved', 'imported', now(),
            ${String(r.source_name ?? "").slice(0, 120)}, ${sourceUrl}, ${verification}, ${r.external_id},
            ${r.related_key ? String(r.related_key).slice(0, 80) : null}, ${r.location_approximate === true})
    ON CONFLICT (external_id) DO UPDATE SET
      category = EXCLUDED.category, description = EXCLUDED.description, verification = EXCLUDED.verification,
      source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url, related_key = EXCLUDED.related_key,
      lat = EXCLUDED.lat, lng = EXCLUDED.lng, location_approximate = EXCLUDED.location_approximate
    RETURNING (xmax = 0) AS inserted
  `;
  result[0].inserted ? inserted++ : updated++;
}
let pruned = 0;
if (prune) {
  const keep = rows.map((r) => r.external_id).filter(Boolean);
  const gone = await sql`
    DELETE FROM reports WHERE source = 'imported' AND NOT (external_id = ANY(${keep})) RETURNING id
  `;
  pruned = gone.length;
}
await sql`
  INSERT INTO sync_status (job, last_run_at, published) VALUES ('manual-import', now(), ${inserted})
  ON CONFLICT (job) DO UPDATE SET last_run_at = now(), published = EXCLUDED.published
`;
console.log(`Imported ${inserted} new reports, updated ${updated}, pruned ${pruned}, skipped ${skipped} invalid.`);

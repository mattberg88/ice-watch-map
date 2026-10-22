// Pulls new Bay Area reports from StopICE and publishes them, applying the same checks used for the
// original import: original (un-mangled) text, privacy scrubbing, OpenStreetMap location checks,
// category detection and duplicate detection against what's already on the map.
//
// Usage: node --env-file-if-exists=.env.local scripts/sync-stopice.mjs [--dry-run [--recheck]] [--days=7]
// Env:   DATABASE_URL (required), STOPICE_API_KEY (optional; without it the nightly XML export is used)
// Runs hourly from .github/workflows/sync-reports.yml.
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const DRY_RUN = process.argv.includes("--dry-run");
// --recheck (dry run only) re-processes alerts already on the map, to test the pipeline end to end.
const RECHECK = DRY_RUN && process.argv.includes("--recheck");
const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 7);
const UA = "ice-watch-map-sync/1.0 (community map; contact via GitHub repo)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(url);

// ---------- Area, privacy and wording rules (kept in step with research/build_map.py) ----------

function inBay(lat, lng) {
  if (!(lat >= 36.9 && lat <= 38.55 && lng >= -123.2 && lng <= -121.5)) return false;
  return !(lat > 38.42 && lng > -121.95); // trims Davis/Dixon
}

const OUTSIDE = /hunting park|tajunga|tujunga|chico\b|canyon lake|stockton ice facility|detained at stockton|winters ca|roseville mn|city of industry/i;

function scrub(text) {
  return String(text ?? "")
    .replace(/\b(?:license\s*plates?|plates?|placas?|tags?|lp#?)\s*(?:#|no\.?|number|:)?\s*([A-Z0-9-]{4,8})\b/gi, (m, p) =>
      /\d/.test(p) ? m.replace(p, "[plate removed]") : m,
    )
    .replace(/\b\d[A-Z]{3}\d{3}\b/gi, "[plate removed]")
    .replace(/\b(?=[A-HJ-NPR-Z0-9]*\d)[A-HJ-NPR-Z0-9]{17}\b/gi, "[VIN removed]")
    .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone removed]")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[email removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

const ARREST_EVENT = new RegExp(
  String.raw`\b(arrested|detained|detaining|kidnapped|kidnapping (a|an|someone|people)|tackled|apprehended|abducted` +
    String.raw`|took (a|an|someone|him|her|them|\d+|two|three|four|five)\b|taken into custody|in (ice )?custody|picked up` +
    String.raw`|arrests? (happening|in progress|made|being made)|arresting|detention of|is being detained|were detained` +
    String.raw`|holding a patient|guarding a patient|hostage` +
    String.raw`|(an|one|two|three|confirmed|reported|another|the|workplace) arrests?|arrests? (at|outside|in|of|near))\b`,
);

function categoryFor(text) {
  let t = text.toLowerCase();
  t = t
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !/stay (vigilant|alert|safe)|is increasing|throughout|recent (kidnappings|arrests|raids)/.test(s))
    .join(" ");
  t = t.replace(
    /\bno (one|kidnappings?|arrests?|detentions?)\b[^.]*|\b(preparing|getting ready|setting up) for [^.]*|\b(not sure|unclear|unconfirmed) if [^.]*/g,
    " ",
  );
  if (ARREST_EVENT.test(t)) return "detention";
  if (t.includes("checkpoint")) return "checkpoint";
  if (/\b(suv|suvs|van|vans|truck|trucks|vehicle|vehicles|car|cars|jeep|tahoe|sedan|durango|explorer)\b/.test(t)) return "vehicle";
  if (/\b(agent|agents|officer|officers|ice|ero|hsi|cbp|dhs|border patrol)\b/.test(t)) return "agents";
  return "other";
}

const VERIFICATION = {
  "URGENT Confirmed ICE report": "confirmed",
  "ICE Sighting": "sighting",
  "Unconfirmed Report": "unconfirmed",
  "Prior incident reporting for record": "prior",
};

// StopICE timestamps are Pacific local time labelled "PST" year-round.
function pacificToIso(stamp) {
  const m = /([a-z]+) (\d+), (\d{4}) \((\d+):(\d+):(\d+)\)/i.exec(stamp ?? "");
  if (!m) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const mon = months.indexOf(m[1].slice(0, 3).toLowerCase());
  if (mon < 0) return null;
  const [y, d, hh, mm, ss] = [m[3], m[2], m[4], m[5], m[6]].map(Number);
  // Daylight time runs from the second Sunday in March to the first Sunday in November.
  const nthSunday = (month, n) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const local = Date.UTC(y, mon, d, hh, mm, ss);
  const dstStart = Date.UTC(y, 2, nthSunday(2, 2), 2);
  const dstEnd = Date.UTC(y, 10, nthSunday(10, 1), 2);
  const offsetHours = local >= dstStart && local < dstEnd ? 7 : 8;
  return new Date(local + offsetHours * 3_600_000).toISOString();
}

// ---------- Fetching StopICE ----------

async function fetchText(u) {
  const res = await fetch(u, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${u}`);
  return res.text();
}

function parseXml(xml) {
  const tag = (block, name) => (new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? "").trim();
  return [...xml.matchAll(/<report_data>([\s\S]*?)<\/report_data>/g)].map(([, b]) => ({
    id: tag(b, "id"),
    url: tag(b, "url"),
    lat: Number(tag(b, "lat")),
    lng: Number(tag(b, "long")),
    priority: tag(b, "thispriority"),
    location: tag(b, "location"),
    observedAt: pacificToIso(tag(b, "timestamp")),
  }));
}

async function alertsFromXml() {
  const now = new Date();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const files = [0, 1].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return `https://www.stopice.net/login/data/stats/stopicenet_${months[d.getUTCMonth()]}_${d.getUTCFullYear()}_complete.xml`;
  });
  const out = [];
  for (const f of files) {
    try {
      out.push(...parseXml(await fetchText(f)));
    } catch (e) {
      console.warn("Couldn't read", f, e.message);
    }
  }
  return out;
}

// The API's JSON shape isn't documented publicly. This assumes it mirrors the XML export's fields
// (id, url, lat, long, thispriority, location, timestamp) and falls back to the XML if it doesn't parse.
async function alertsFromApi(key) {
  const api = `https://stopice.net/api/?key=${encodeURIComponent(key)}&recentalerts=1&lat=37.75&long=-122.25&distance=70`;
  const data = JSON.parse(await fetchText(api));
  const rows = Array.isArray(data) ? data : data.alerts ?? data.data ?? data.results ?? [];
  const alerts = rows.map((r) => ({
    id: String(r.id ?? r.alert_id ?? ""),
    url: r.url ?? (r.id ? `https://www.stopice.net/?alert=${r.id}` : ""),
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.long ?? r.lng ?? r.longitude),
    priority: r.thispriority ?? r.priority_label ?? r.priority ?? "",
    location: r.location ?? r.address ?? "",
    observedAt: pacificToIso(r.timestamp ?? "") ?? (r.timestamp ? new Date(r.timestamp).toISOString() : null),
  }));
  if (!alerts.length || alerts.some((a) => !a.id || !Number.isFinite(a.lat))) throw new Error("unexpected API response");
  return alerts;
}

// The export lowercases and strips punctuation ("4-5 people" -> "45 people"), so always use the alert page text.
async function originalText(id) {
  const page = await fetchText(`https://www.stopice.net/login/?alert=${encodeURIComponent(id)}`);
  const m = /<img src=messageicon1\.png[^>]*>[\s\S]*?<FONT STYLE=FONT-SIZE:15PT; color=#333>([\s\S]*?)<table/i.exec(page);
  if (!m) return null;
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Location checks against OpenStreetMap ----------

const STREETISH = /\d|\b(st|street|ave|avenue|rd|road|blvd|boulevard|way|dr|drive|hwy|highway|fwy|freeway|ct|ln|lane|pl|plaza|pkwy|parkway|and|&|@|at|park|center|centre|mall|bart|station|school|hospital|court|airport|market|depot|costco|target|walmart|safeway|library)\b/i;
const POINT_CLASSES = ["place/house", "building/", "amenity/", "shop/", "tourism/", "railway/", "highway/bus_stop", "office/", "leisure/", "healthcare/", "public_transport/", "aeroway/"];

async function geocode(q) {
  const params = new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "us" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": UA } });
  await sleep(1100); // Nominatim's usage policy: at most one request per second
  if (!res.ok) return null;
  const [hit] = await res.json();
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), cls: `${hit.class}/${hit.type}`, name: hit.display_name ?? "" } : null;
}

/** Returns { lat, lng, approximate } or null when the report turns out to be outside the Bay Area. */
async function checkLocation(alert) {
  const loc = alert.location;
  const keep = { lat: alert.lat, lng: alert.lng, approximate: true };
  if (/^\s*\d{6,}\s+\d{6,}\s*$/.test(loc)) return { lat: alert.lat, lng: alert.lng, approximate: false }; // raw coordinates
  if (!STREETISH.test(loc.replace(/\b\d{5}\b/g, ""))) return keep; // only a city or ZIP
  const hit = await geocode(loc);
  if (!hit) return keep;
  if (!inBay(hit.lat, hit.lng)) return null;
  const number = /^\s*(\d{1,6})\s+[A-Za-z]/.exec(loc)?.[1];
  const ordinal = /\b(\d+)(st|nd|rd|th)\b/i.exec(loc);
  if (ordinal && !new RegExp(`\\b${ordinal[1]}(st|nd|rd|th)\\b`, "i").test(hit.name)) return keep; // matched a different street
  const point = POINT_CLASSES.some((c) => hit.cls.startsWith(c)) && (!number || new RegExp(`\\b${number}\\b`).test(hit.name));
  if (point) return { lat: hit.lat, lng: hit.lng, approximate: false };
  if (hit.cls.startsWith("highway/")) return { lat: hit.lat, lng: hit.lng, approximate: true };
  return keep;
}

// ---------- Main ----------

function meters(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180 * Math.cos((a.lat * Math.PI) / 180);
  return 6371000 * Math.hypot(dLat, dLng);
}

const key = process.env.STOPICE_API_KEY;
let alerts;
let feed = "nightly XML export";
if (key) {
  try {
    alerts = await alertsFromApi(key);
    feed = "API";
  } catch (e) {
    console.warn("StopICE API failed, using the XML export instead:", e.message);
  }
}
alerts ??= await alertsFromXml();

const since = Date.now() - DAYS * 86_400_000;
const candidates = alerts.filter(
  (a) => a.id && VERIFICATION[a.priority] && a.observedAt && Date.parse(a.observedAt) >= since && inBay(a.lat, a.lng),
);

const existing = await sql`
  SELECT lat, lng, observed_at, source_url, external_id FROM reports
  WHERE observed_at > now() - make_interval(days => ${DAYS + 2})
`;
const skipped = new Set((await sql`SELECT external_id FROM import_skips`).map((r) => r.external_id));
const seenUrls = new Set(existing.map((r) => r.source_url));
const placed = existing.map((r) => ({ lat: r.lat, lng: r.lng, t: Date.parse(r.observed_at) }));

let published = 0;
const skips = [];
for (const a of candidates) {
  const externalId = createHash("sha1").update(`StopICE|${a.url}`).digest("hex").slice(0, 20);
  if (!RECHECK && (seenUrls.has(a.url) || skipped.has(externalId))) continue;

  const text = await originalText(a.id).catch(() => null);
  if (!text) continue; // try again next run rather than publish mangled text
  if (OUTSIDE.test(`${a.location} ${text}`)) {
    skips.push([externalId, "outside the Bay Area"]);
    continue;
  }
  const where = await checkLocation(a);
  if (!where) {
    skips.push([externalId, "geocoded outside the Bay Area"]);
    continue;
  }
  const t = Date.parse(a.observedAt);
  const duplicate = !RECHECK && placed.find((p) => Math.abs(p.t - t) <= 6 * 3_600_000 && meters(p, where) <= 400);
  if (duplicate) {
    skips.push([externalId, "duplicate of a report already on the map"]);
    continue;
  }

  const row = {
    externalId,
    category: categoryFor(text),
    description: scrub(text),
    lat: Math.round(where.lat * 1000) / 1000,
    lng: Math.round(where.lng * 1000) / 1000,
    observedAt: a.observedAt,
    verification: VERIFICATION[a.priority],
    url: a.url,
    approximate: where.approximate,
  };
  console.log(`${DRY_RUN ? "[dry run] " : ""}publish ${row.observedAt} ${row.category}/${row.verification}${row.approximate ? " (approx)" : ""}: ${row.description.slice(0, 90)}`);
  if (!DRY_RUN) {
    await sql`
      INSERT INTO reports (category, description, lat, lng, observed_at, status, source, reviewed_at,
                           source_name, source_url, verification, external_id, location_approximate)
      VALUES (${row.category}, ${row.description}, ${row.lat}, ${row.lng}, ${row.observedAt}, 'approved', 'imported', now(),
              'StopICE', ${row.url}, ${row.verification}, ${row.externalId}, ${row.approximate})
      ON CONFLICT (external_id) DO NOTHING
    `;
  }
  placed.push({ lat: row.lat, lng: row.lng, t });
  seenUrls.add(a.url);
  published++;
}

if (!DRY_RUN) {
  for (const [id, reason] of skips) {
    await sql`INSERT INTO import_skips (external_id, reason) VALUES (${id}, ${reason}) ON CONFLICT DO NOTHING`;
  }
  await sql`
    INSERT INTO sync_status (job, last_run_at, published) VALUES ('stopice', now(), ${published})
    ON CONFLICT (job) DO UPDATE SET last_run_at = now(), published = EXCLUDED.published
  `;
}
console.log(`StopICE ${feed}: ${candidates.length} recent Bay Area alerts, published ${published}, skipped ${skips.length}${DRY_RUN ? " (dry run)" : ""}.`);

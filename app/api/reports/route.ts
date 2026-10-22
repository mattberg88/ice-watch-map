import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { PublicReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Imported history reaches back to 2025; three years leaves room to grow.
const MAX_HOURS = 3 * 365 * 24;

// GET /api/reports?hours=12 — approved reports observed in the last N hours (up to MAX_HOURS)
export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("hours") ?? 12);
  const hours = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), MAX_HOURS) : 12;

  const rows = (await db()`
    SELECT id, category, description, lat, lng, observed_at, source, source_name, source_url, verification, related_key, location_approximate, report_count
    FROM reports
    WHERE status = 'approved' AND observed_at > now() - make_interval(hours => ${hours})
    ORDER BY observed_at DESC
    LIMIT 3000
  `) as PublicReport[];

  // When the data was last refreshed by a sync or import job (not when this request ran).
  const [{ synced_at: syncedAt }] = (await db()`
    SELECT max(last_run_at) AS synced_at FROM sync_status
  `) as { synced_at: string | null }[];

  return NextResponse.json(
    { reports: rows, syncedAt },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } },
  );
}

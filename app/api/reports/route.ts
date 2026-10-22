import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, hashIp, isAdmin } from "@/lib/auth";
import { newReportSchema, personalDetailIssue, roundCoord } from "@/lib/validation";
import type { PublicReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REPORTS_PER_HOUR = 5;

// Imported history reaches back to 2025; three years leaves room to grow.
const MAX_HOURS = 3 * 365 * 24;

// GET /api/reports?hours=12 — approved reports observed in the last N hours (up to MAX_HOURS)
export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("hours") ?? 12);
  const hours = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), MAX_HOURS) : 12;

  const rows = (await db()`
    SELECT id, category, description, lat, lng, observed_at, source, source_name, source_url, verification, related_key, location_approximate
    FROM reports
    WHERE status = 'approved' AND observed_at > now() - make_interval(hours => ${hours})
    ORDER BY observed_at DESC
    LIMIT 3000
  `) as PublicReport[];

  return NextResponse.json(
    { reports: rows },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } },
  );
}

// POST /api/reports — community submissions go to the moderation queue;
// moderator submissions are published immediately.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = newReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid report" }, { status: 400 });
  }
  const report = parsed.data;

  const issue = personalDetailIssue(report.description);
  if (issue) {
    return NextResponse.json(
      { error: `Please remove ${issue} from the description. Don't post identifying details about anyone.` },
      { status: 400 },
    );
  }

  const admin = await isAdmin();
  const ipHash = hashIp(clientIp(req.headers));

  if (!admin) {
    const [{ count }] = (await db()`
      SELECT count(*)::int AS count FROM reports
      WHERE ip_hash = ${ipHash} AND created_at > now() - interval '1 hour'
    `) as { count: number }[];
    if (count >= MAX_REPORTS_PER_HOUR) {
      return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
    }
  }

  const status = admin ? "approved" : "pending";
  const source = admin ? "moderator" : "community";

  const [row] = (await db()`
    INSERT INTO reports (category, description, lat, lng, observed_at, status, source, reviewed_at, ip_hash)
    VALUES (
      ${report.category}, ${report.description}, ${roundCoord(report.lat)}, ${roundCoord(report.lng)},
      ${report.observedAt}, ${status}, ${source}, ${admin ? new Date().toISOString() : null}, ${ipHash}
    )
    RETURNING id, status
  `) as { id: string; status: string }[];

  return NextResponse.json(row, { status: 201 });
}

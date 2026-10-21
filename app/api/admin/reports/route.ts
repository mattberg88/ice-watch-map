import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import type { Report } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/reports?status=pending|approved|rejected
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = req.nextUrl.searchParams.get("status");
  const status = requested === "approved" || requested === "rejected" ? requested : "pending";

  const rows = (await db()`
    SELECT id, category, description, lat, lng, observed_at, created_at, status, source
    FROM reports
    WHERE status = ${status}
    ORDER BY created_at DESC
    LIMIT 200
  `) as Report[];

  return NextResponse.json({ reports: rows }, { headers: { "Cache-Control": "no-store" } });
}

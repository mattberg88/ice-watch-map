import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called daily by Vercel Cron (see vercel.json). Vercel sends CRON_SECRET as a Bearer token.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.max(1, Number(process.env.RETENTION_DAYS ?? 7) || 7);

  const old = await db()`
    DELETE FROM reports WHERE created_at < now() - make_interval(days => ${days}) RETURNING id
  `;
  // Rejected and stale pending reports don't need to stick around.
  const junk = await db()`
    DELETE FROM reports
    WHERE (status = 'rejected' AND reviewed_at < now() - interval '1 day')
       OR (status = 'pending' AND created_at < now() - interval '2 days')
    RETURNING id
  `;

  return NextResponse.json({ deleted: old.length + junk.length });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const updateSchema = z.object({ status: z.enum(["approved", "rejected", "pending"]) });

// PATCH /api/admin/reports/:id  { status }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad status" }, { status: 400 });

  const rows = await db()`
    UPDATE reports SET status = ${parsed.data.status}, reviewed_at = now()
    WHERE id = ${id}
    RETURNING id, status
  `;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

// DELETE /api/admin/reports/:id — remove a report entirely
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await db()`DELETE FROM reports WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

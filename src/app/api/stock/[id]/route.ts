import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Shared DB error helper — gives useful messages instead of generic "Failed"
function describeDbError(e: unknown, context: string): string {
  const err = e as { code?: string; message?: string };
  console.error(`[${context}] DB error:`, { code: err?.code, message: err?.message });
  if (err?.code === "P1001" || /can't reach database/i.test(err?.message || "")) {
    return "Can't reach the database — check DATABASE_URL is correct and the DB is running.";
  }
  if (err?.code === "P2021" || /does not exist/i.test(err?.message || "")) {
    return `Database table/column is missing — run "npx prisma db push" against your production DATABASE_URL.`;
  }
  if (err?.code === "P2025") {
    return "Item not found — it may have already been deleted.";
  }
  if (err?.code === "P1000") {
    return "Database authentication failed — check the username/password in DATABASE_URL.";
  }
  if (err?.code) {
    return `Database error ${err.code}: ${err.message ?? "unknown"}`;
  }
  return err?.message || `Unknown error in ${context}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await db.stockItem.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true, image: true,
        category: true, price: true, quantity: true, soldCount: true,
        tags: true, createdAt: true,
      },
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "GET /api/stock/[id]") }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, image, category, price, quantity, credentials, tags } = body;
    const item = await db.stockItem.update({
      where: { id },
      data: {
        name, description, image, category,
        price: Number(price) || 0,
        quantity: Number(quantity) || 1,
        credentials: typeof credentials === "string" ? credentials : credentials !== undefined ? JSON.stringify(credentials) : undefined,
        tags,
      },
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "PUT /api/stock/[id]") }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.stockItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "DELETE /api/stock/[id]") }, { status: 500 });
  }
}

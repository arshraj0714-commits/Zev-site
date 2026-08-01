import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Shared DB error helper
function describeDbError(e: unknown, context: string): string {
  const err = e as { code?: string; message?: string };
  console.error(`[${context}] DB error:`, { code: err?.code, message: err?.message });
  if (err?.code === "P1001" || /can't reach database/i.test(err?.message || "")) {
    return "Can't reach the database — check DATABASE_URL is correct and the DB is running.";
  }
  if (err?.code === "P2021" || /does not exist/i.test(err?.message || "")) {
    return `Database table/column is missing — run "npx prisma db push" against your production DATABASE_URL.`;
  }
  if (err?.code === "P1000") {
    return "Database authentication failed — check the username/password in DATABASE_URL.";
  }
  if (err?.code) {
    return `Database error ${err.code}: ${err.message ?? "unknown"}`;
  }
  return err?.message || `Unknown error in ${context}`;
}

// GET /api/stock  — never returns credentials field
export async function GET() {
  try {
    const items = await db.stockItem.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, description: true, image: true,
        category: true, price: true, quantity: true, soldCount: true,
        tags: true, createdAt: true,
      },
    });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "GET /api/stock") }, { status: 500 });
  }
}

// POST /api/stock — admin adds credentials
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, image, category, price, quantity, credentials, tags } = body;
    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
    }
    const item = await db.stockItem.create({
      data: {
        name, description,
        image: image || null,
        category: category || null,
        price: Number(price) || 0,
        quantity: Number(quantity) || 1,
        credentials: typeof credentials === "string" ? credentials : JSON.stringify(credentials || []),
        tags: tags || null,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "POST /api/stock") }, { status: 500 });
  }
}

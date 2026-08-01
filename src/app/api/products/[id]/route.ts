import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Turns a Prisma/DB error into (a) a full server-side log so it shows up in
// Vercel's Function logs, and (b) a short, useful message we can safely send
// back to the client so the UI toast isn't just a generic "Failed".
function describeDbError(e: unknown, context: string): string {
  const err = e as { code?: string; message?: string; meta?: unknown };
  // eslint-disable-next-line no-console
  console.error(`[${context}] DB error:`, {
    code: err?.code,
    message: err?.message,
    meta: err?.meta,
  });

  if (err?.code === "P1001" || /can't reach database/i.test(err?.message || "")) {
    return "Can't reach the database — check DATABASE_URL is correct and the DB is running.";
  }
  if (err?.code === "P2021" || /does not exist/i.test(err?.message || "")) {
    return `Database table/column is missing — run "npx prisma db push" against your production DATABASE_URL. (${err?.message ?? ""})`;
  }
  if (err?.code === "P2025") {
    return "Product not found — it may have already been deleted.";
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
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true, image: true, codeLink: true, folder: true,
        type: true, price: true, tags: true, featured: true, salesCount: true,
        fileName: true, fileSize: true, createdAt: true, updatedAt: true,
      },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "GET /api/products/[id]") }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, image, codeLink, folder, type, price, tags, featured } = body;

    const data: Record<string, unknown> = {
      name, description, image, codeLink, folder,
      type: type === "free" ? "free" : "paid",
      price: type === "free" ? 0 : Number(price) || 0,
      tags, featured,
    };

    // The zip file is only touched if the client explicitly sent it — this
    // lets the edit modal update every other field without accidentally
    // wiping out (or needing to re-upload) an existing attached file.
    if ("fileData" in body) {
      const { fileData, fileName, fileSize } = body;
      data.fileData = fileData || null;
      data.fileName = fileData ? (fileName || null) : null;
      data.fileSize = fileData ? (Number(fileSize) || null) : null;
    }

    const product = await db.product.update({ where: { id }, data });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "PUT /api/products/[id]") }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "DELETE /api/products/[id]") }, { status: 500 });
  }
}

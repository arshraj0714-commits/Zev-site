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
  if (err?.code === "P1000") {
    return "Database authentication failed — check the username/password in DATABASE_URL.";
  }
  if (err?.code) {
    return `Database error ${err.code}: ${err.message ?? "unknown"}`;
  }
  return err?.message || `Unknown error in ${context}`;
}

// GET /api/products?type=paid|free|all
// NOTE: fileData (the base64 zip blob) is intentionally excluded here — this
// endpoint powers the public marketplace listing and admin dashboard list, so
// we only return lightweight metadata (fileName/fileSize) to indicate a zip
// is attached, not the file content itself.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";
    const where = type === "all" ? {} : { type };
    const products = await db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        codeLink: true,
        folder: true,
        type: true,
        price: true,
        tags: true,
        featured: true,
        salesCount: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "GET /api/products") }, { status: 500 });
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, description, image, codeLink, folder, type, price, tags, featured,
      fileName, fileData, fileSize,
    } = body;
    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
    }
    const product = await db.product.create({
      data: {
        name,
        description,
        image: image || null,
        codeLink: codeLink || null,
        folder: folder || null,
        type: type === "free" ? "free" : "paid",
        price: type === "free" ? 0 : Number(price) || 0,
        tags: tags || null,
        featured: !!featured,
        fileName: fileData ? (fileName || null) : null,
        fileData: fileData || null,
        fileSize: fileData ? (Number(fileSize) || null) : null,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e, "POST /api/products") }, { status: 500 });
  }
}

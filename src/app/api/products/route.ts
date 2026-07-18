import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/products?type=paid|free|all
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";
    const where = type === "all" ? {} : { type };
    const products = await db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, image, codeLink, folder, type, price, tags, featured } = body;
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
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

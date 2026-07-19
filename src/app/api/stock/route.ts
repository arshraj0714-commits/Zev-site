import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

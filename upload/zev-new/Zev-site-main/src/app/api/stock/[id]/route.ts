import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.stockItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

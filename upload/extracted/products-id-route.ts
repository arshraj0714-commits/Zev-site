import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

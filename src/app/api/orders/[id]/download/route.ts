import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/orders/[id]/download
// Streams the attached zip file for a product order — but ONLY once the
// order has actually been marked "paid". This is the single gate that makes
// the zip download safe to attach a "Download" button to: even if someone
// guesses/shares an order id, they get nothing until that order is paid.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "paid") {
      return NextResponse.json({ error: "Payment not verified yet" }, { status: 403 });
    }
    if (order.itemType !== "product" || !order.productId) {
      return NextResponse.json({ error: "No file attached to this order" }, { status: 404 });
    }

    const product = await db.product.findUnique({
      where: { id: order.productId },
      select: { fileName: true, fileData: true },
    });
    if (!product?.fileData) {
      return NextResponse.json({ error: "No file attached to this product" }, { status: 404 });
    }

    // fileData is stored as a base64 data URL, e.g. "data:application/zip;base64,XXXX"
    const commaIdx = product.fileData.indexOf(",");
    const base64 = commaIdx >= 0 ? product.fileData.slice(commaIdx + 1) : product.fileData;
    const buffer = Buffer.from(base64, "base64");
    const filename = (product.fileName || "download.zip").replace(/["\r\n]/g, "");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

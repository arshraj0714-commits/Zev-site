import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

// GET /api/orders/[id]
// Returns full order details including deliveredContent.
// - Admin: can view any order
// - Logged-in user: can only view orders matching their email
// - Guest: can view if they provide the correct email as a query param
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email")?.trim().toLowerCase();

    const order = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        itemType: true,
        itemName: true,
        amount: true,
        paymentMethod: true,
        cryptoAmount: true,
        txHash: true,
        buyerEmail: true,
        buyerDiscord: true,
        status: true,
        deliveredContent: true,
        createdAt: true,
        updatedAt: true,
        productId: true,
        stockId: true,
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Permission check
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    const isAdmin = user?.role === "admin";

    if (!isAdmin) {
      // Non-admin: must match the order's buyerEmail
      const claimEmail = user?.email?.toLowerCase() || emailParam;
      if (!claimEmail || order.buyerEmail?.toLowerCase() !== claimEmail) {
        return NextResponse.json({ error: "Unauthorized — this order belongs to a different email" }, { status: 403 });
      }
    }

    // Check if product has a downloadable file
    let file: { name: string; size: number | null } | null = null;
    if (order.itemType === "product" && order.productId && order.status === "paid") {
      const p = await db.product.findUnique({
        where: { id: order.productId },
        select: { fileName: true, fileSize: true, fileData: true },
      });
      if (p?.fileData) file = { name: p.fileName || "download.zip", size: p.fileSize ?? null };
    }

    return NextResponse.json({ order, file });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/orders/[id]/confirm — buyer confirms they sent payment.
// Marks order as paid and delivers content immediately (trust-based, simple flow).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "paid") {
      return NextResponse.json({
        order,
        alreadyPaid: true,
        delivered: order.deliveredContent,
        message: "Order already paid.",
      });
    }

    let deliveredContent = order.deliveredContent;

    // Deliver content based on item type
    if (order.itemType === "product" && order.productId) {
      const p = await db.product.findUnique({ where: { id: order.productId } });
      if (p) {
        deliveredContent = p.codeLink
          ? `✅ Purchase confirmed!\n\nProduct: ${p.name}\nCode Link: ${p.codeLink}\n\nThank you for your purchase. If you have any issues, join our Discord support server.`
          : `✅ Purchase confirmed!\n\nProduct: ${p.name}\n\n(No external code link was provided for this product. Contact support if you need access.)`;
        await db.product.update({
          where: { id: p.id },
          data: { salesCount: { increment: 1 } },
        });
      }
    } else if (order.itemType === "stock" && order.stockId) {
      const s = await db.stockItem.findUnique({ where: { id: order.stockId } });
      if (s) {
        deliveredContent = `✅ Purchase confirmed!\n\nItem: ${s.name}\n\n--- CREDENTIALS ---\n${formatCredentials(s.credentials)}\n\nStore these safely. Thank you for your purchase!`;
        await db.stockItem.update({
          where: { id: s.id },
          data: { soldCount: { increment: 1 } },
        });
      }
    }

    const updated = await db.order.update({
      where: { id },
      data: { status: "paid", deliveredContent },
    });

    // Increment site-wide stats
    await db.siteStats.upsert({
      where: { id: "singleton" },
      update: { productsSold: { increment: 1 } },
      create: { id: "singleton", productsSold: 1, vouches: 1000 },
    });

    return NextResponse.json({
      order: updated,
      delivered: deliveredContent,
      message: "Payment confirmed! Your purchase has been delivered.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function formatCredentials(raw: string | null): string {
  if (!raw) return "(No credentials stored)";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .map((c: { label?: string; value?: string }, i: number) => `${i + 1}. ${c.label ?? "Field"}: ${c.value ?? ""}`)
        .join("\n");
    }
    if (typeof arr === "object") {
      return Object.entries(arr).map(([k, v]) => `${k}: ${v}`).join("\n");
    }
    return String(arr);
  } catch {
    return raw;
  }
}

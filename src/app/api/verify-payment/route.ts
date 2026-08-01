import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPayment } from "@/lib/payments";
import { WALLET_ADDRESSES } from "@/lib/config";

// POST /api/verify-payment  { orderId, txHash }
// Legacy manual verification route. Now uses the same time + used-txHash
// filtering as the auto-detect check endpoint, so old transactions can't
// pay for new orders.
export async function POST(req: NextRequest) {
  try {
    const { orderId, txHash } = await req.json();
    if (!orderId || !txHash) {
      return NextResponse.json({ error: "orderId and txHash are required" }, { status: 400 });
    }
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "paid") {
      return NextResponse.json({
        verified: true,
        alreadyPaid: true,
        order,
        message: "Order already paid.",
      });
    }

    // Collect tx hashes already used by OTHER paid orders
    const usedOrders = await db.order.findMany({
      where: { status: "paid", txHash: { not: null } },
      select: { txHash: true },
    });
    const usedTxHashes = new Set(
      usedOrders.map((o) => o.txHash).filter((t): t is string => !!t)
    );

    // Only consider transactions that happened AFTER the order was created
    const sinceTimestamp = Math.floor(order.createdAt.getTime() / 1000);

    // verifyPayment now delegates to scanWalletForPayment with the same
    // time + used-txHash filtering used by the auto-detect endpoint.
    const result = await verifyPayment(
      order.paymentMethod as keyof typeof WALLET_ADDRESSES,
      txHash.trim(),
      order.cryptoAmount,
      sinceTimestamp,
      usedTxHashes
    );

    if (!result.verified) {
      // keep order pending but record txHash
      await db.order.update({
        where: { id: orderId },
        data: { txHash: txHash.trim() },
      });
      return NextResponse.json({
        verified: false,
        result,
        message: result.error || "Payment not verified yet. Make sure the transaction is confirmed and sends the correct amount to the correct address.",
      }, { status: 200 });
    }

    // Payment verified — deliver content
    let deliveredContent = order.deliveredContent;

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
      where: { id: orderId },
      data: {
        status: "paid",
        txHash: txHash.trim(),
        deliveredContent,
      },
    });

    // Increment site-wide stats
    await db.siteStats.upsert({
      where: { id: "singleton" },
      update: { productsSold: { increment: 1 } },
      create: { id: "singleton", productsSold: 1, vouches: 1000 },
    });

    return NextResponse.json({
      verified: true,
      order: updated,
      result,
      message: "Payment verified successfully! Your purchase has been delivered.",
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
      return arr.map((c: { label?: string; value?: string }, i: number) => `${i + 1}. ${c.label ?? "Field"}: ${c.value ?? ""}`).join("\n");
    }
    if (typeof arr === "object") {
      return Object.entries(arr).map(([k, v]) => `${k}: ${v}`).join("\n");
    }
    return String(arr);
  } catch {
    return raw;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanWalletForPayment } from "@/lib/payments";
import { sendPurchaseEmail, isEmailConfigured } from "@/lib/email";

// GET /api/orders/[id]/check
// Lightweight polling endpoint — called automatically by the checkout modal
// every few seconds. Scans Arsh's wallet for a matching payment (pending OR
// confirmed). If found, delivers the product and returns verified:true.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Already paid? return delivered content
    if (order.status === "paid") {
      let file: { name: string; size: number | null } | null = null;
      if (order.itemType === "product" && order.productId) {
        const p = await db.product.findUnique({ where: { id: order.productId } });
        if (p?.fileData) file = { name: p.fileName || "download.zip", size: p.fileSize ?? null };
      }
      return NextResponse.json({
        verified: true,
        alreadyPaid: true,
        delivered: order.deliveredContent,
        message: "Order already paid.",
        file,
      });
    }

    // Scan the blockchain for a matching payment
    const scan = await scanWalletForPayment(
      order.paymentMethod as any,
      order.cryptoAmount
    );

    if (!scan.verified) {
      return NextResponse.json({
        verified: false,
        found: scan.found,
        confirmed: scan.confirmed,
        amountReceived: scan.amountReceived,
        expectedAmount: scan.expectedAmount,
        message: scan.found
          ? "Transaction detected but amount doesn't match yet."
          : "Waiting for your payment... Send the exact amount to the address above.",
      });
    }

    // Payment detected! Deliver content
    let deliveredContent = order.deliveredContent;
    let file: { name: string; size: number | null } | null = null;

    if (order.itemType === "product" && order.productId) {
      const p = await db.product.findUnique({ where: { id: order.productId } });
      if (p) {
        deliveredContent = p.codeLink
          ? `✅ Payment auto-detected on-chain!\n\nProduct: ${p.name}\nCode Link: ${p.codeLink}\n\nTx: ${scan.txHash ?? "—"}\n\nThank you for your purchase. If you have any issues, join our Discord support server.`
          : `✅ Payment auto-detected on-chain!\n\nProduct: ${p.name}\n\nTx: ${scan.txHash ?? "—"}\n\n(No external code link was provided for this product. Contact support if you need access.)`;
        if (p.fileData) file = { name: p.fileName || "download.zip", size: p.fileSize ?? null };
        await db.product.update({
          where: { id: p.id },
          data: { salesCount: { increment: 1 } },
        });
      }
    } else if (order.itemType === "stock" && order.stockId) {
      const s = await db.stockItem.findUnique({ where: { id: order.stockId } });
      if (s) {
        deliveredContent = `✅ Payment auto-detected on-chain!\n\nItem: ${s.name}\nTx: ${scan.txHash ?? "—"}\n\n--- CREDENTIALS ---\n${formatCredentials(s.credentials)}\n\nStore these safely. Thank you for your purchase!`;
        await db.stockItem.update({
          where: { id: s.id },
          data: { soldCount: { increment: 1 } },
        });
      }
    }

    const updated = await db.order.update({
      where: { id },
      data: { status: "paid", txHash: scan.txHash, deliveredContent },
    });

    await db.siteStats.upsert({
      where: { id: "singleton" },
      update: { productsSold: { increment: 1 } },
      create: { id: "singleton", productsSold: 1, vouches: 1000 },
    });

    // Send email
    let emailSent = false;
    if (order.buyerEmail) {
      const er = await sendPurchaseEmail(order.buyerEmail, order.itemName, deliveredContent || "");
      emailSent = er.sent;
    }

    return NextResponse.json({
      verified: true,
      order: updated,
      delivered: deliveredContent,
      txHash: scan.txHash,
      emailSent,
      emailConfigured: isEmailConfigured(),
      file,
      message: "Payment auto-detected! Your purchase has been delivered.",
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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanWalletForPayment } from "@/lib/payments";

// POST /api/orders/[id]/confirm
// Buyer clicks "I've Paid - Confirm". The server scans Arsh's wallet on the
// blockchain for any incoming transaction (pending OR confirmed) matching the
// exact crypto amount. Only if a match is found is the order delivered.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Already paid? deliver immediately
    if (order.status === "paid") {
      return NextResponse.json({
        order,
        alreadyPaid: true,
        delivered: order.deliveredContent,
        verified: true,
        message: "Order already paid.",
      });
    }

    // Scan the blockchain for a matching payment
    const scan = await scanWalletForPayment(
      order.paymentMethod as any,
      order.cryptoAmount
    );

    if (!scan.verified) {
      // Payment not detected — do NOT deliver
      return NextResponse.json({
        verified: false,
        delivered: null,
        scan: {
          found: scan.found,
          confirmed: scan.confirmed,
          amountReceived: scan.amountReceived,
          checkedAddress: scan.checkedAddress,
          expectedAmount: scan.expectedAmount,
          txHash: scan.txHash,
        },
        message: scan.error
          ? `Couldn't verify payment yet: ${scan.error} Please wait a moment and try again.`
          : scan.found
            ? `A transaction was seen on your wallet but it didn't match the exact amount of ${order.cryptoAmount.toFixed(8)} ${order.paymentMethod}. Please send the exact amount shown.`
            : `No payment detected yet. Send exactly ${order.cryptoAmount.toFixed(8)} ${order.paymentMethod} to the address, then click "I've Paid - Confirm" again. (It can take a few minutes for transactions to appear on the blockchain.)`,
      }, { status: 200 });
    }

    // Payment verified on-chain — deliver content now
    let deliveredContent = order.deliveredContent;

    if (order.itemType === "product" && order.productId) {
      const p = await db.product.findUnique({ where: { id: order.productId } });
      if (p) {
        deliveredContent = p.codeLink
          ? `✅ Payment verified on-chain!\n\nProduct: ${p.name}\nCode Link: ${p.codeLink}\n\nTx: ${scan.txHash ?? "—"}\n\nThank you for your purchase. If you have any issues, join our Discord support server.`
          : `✅ Payment verified on-chain!\n\nProduct: ${p.name}\n\nTx: ${scan.txHash ?? "—"}\n\n(No external code link was provided for this product. Contact support if you need access.)`;
        await db.product.update({
          where: { id: p.id },
          data: { salesCount: { increment: 1 } },
        });
      }
    } else if (order.itemType === "stock" && order.stockId) {
      const s = await db.stockItem.findUnique({ where: { id: order.stockId } });
      if (s) {
        deliveredContent = `✅ Payment verified on-chain!\n\nItem: ${s.name}\nTx: ${scan.txHash ?? "—"}\n\n--- CREDENTIALS ---\n${formatCredentials(s.credentials)}\n\nStore these safely. Thank you for your purchase!`;
        await db.stockItem.update({
          where: { id: s.id },
          data: { soldCount: { increment: 1 } },
        });
      }
    }

    const updated = await db.order.update({
      where: { id },
      data: {
        status: "paid",
        txHash: scan.txHash,
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
      order: updated,
      delivered: deliveredContent,
      verified: true,
      txHash: scan.txHash,
      message: "Payment verified on the blockchain! Your purchase has been delivered.",
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

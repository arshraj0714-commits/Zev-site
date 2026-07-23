import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanWalletForPayment } from "@/lib/payments";
import { sendPurchaseEmail, isEmailConfigured } from "@/lib/email";
import { generateInvoiceHtml, generateInvoiceText, type InvoiceData } from "@/lib/invoice";
import { PAYMENT_METHODS } from "@/lib/config";

// GET /api/orders/[id]/check
// Polls the blockchain for a matching payment. Only backend can mark as paid.
// Creates a Payment record on verification, generates invoice, sends email.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Already paid? Return delivered content + payment record
    if (order.status === "paid") {
      let file: { name: string; size: number | null } | null = null;
      if (order.itemType === "product" && order.productId) {
        const p = await db.product.findUnique({ where: { id: order.productId } });
        if (p?.fileData) file = { name: p.fileName || "download.zip", size: p.fileSize ?? null };
      }
      const payment = await db.payment.findUnique({ where: { orderId: order.id } }).catch(() => null);
      return NextResponse.json({
        verified: true,
        alreadyPaid: true,
        delivered: order.deliveredContent,
        payment: payment ? {
          blockchain: payment.blockchain,
          transactionHash: payment.transactionHash,
          amountReceived: payment.amountReceived,
          confirmations: payment.confirmations,
          verificationSource: payment.verificationSource,
        } : null,
        message: "Order already paid.",
        file,
      });
    }

    // --- SECURITY: Collect used tx hashes to prevent double-spending ---
    const usedOrders = await db.order.findMany({
      where: { status: "paid", txHash: { not: null } },
      select: { txHash: true },
    });
    const usedTxHashes = new Set(
      usedOrders.map((o) => o.txHash).filter((t): t is string => !!t)
    );

    // --- TIME FILTER: Only accept txs after order creation ---
    const sinceTimestamp = Math.floor(order.createdAt.getTime() / 1000);

    // --- SCAN BLOCKCHAIN ---
    console.log(`[check] Order ${order.orderNumber}: scanning ${order.paymentMethod} for ${order.cryptoAmount} since ${sinceTimestamp}`);
    const scan = await scanWalletForPayment(
      order.paymentMethod as any,
      order.cryptoAmount,
      sinceTimestamp,
      usedTxHashes
    );

    if (!scan.verified) {
      // Log the scan result for debugging
      if (scan.found) {
        console.log(`[check] Order ${order.orderNumber}: tx found but NOT verified — ${scan.error || "amount mismatch"}`);
      }
      return NextResponse.json({
        verified: false,
        found: scan.found,
        confirmed: scan.confirmed,
        amountReceived: scan.amountReceived,
        expectedAmount: scan.expectedAmount,
        message: scan.found
          ? "Transaction detected — verifying amount and confirmations..."
          : "Waiting for your payment... Send the exact amount to the address above.",
      });
    }

    // ============ PAYMENT VERIFIED ============
    console.log(`[check] Order ${order.orderNumber}: PAYMENT VERIFIED — tx=${scan.txHash}, source=${scan.verificationSource}`);

    // --- DELIVER CONTENT ---
    let deliveredContent = order.deliveredContent;
    let file: { name: string; size: number | null } | null = null;

    if (order.itemType === "product" && order.productId) {
      const p = await db.product.findUnique({ where: { id: order.productId } });
      if (p) {
        deliveredContent = p.codeLink
          ? `✅ Payment verified on-chain!\n\nProduct: ${p.name}\nCode Link: ${p.codeLink}\n\nTx: ${scan.txHash ?? "—"}\nNetwork: ${scan.verificationSource}\n\nThank you for your purchase. If you have any issues, join our Discord support server.`
          : `✅ Payment verified on-chain!\n\nProduct: ${p.name}\n\nTx: ${scan.txHash ?? "—"}\nNetwork: ${scan.verificationSource}\n\n(No external code link was provided. Contact support if you need access.)`;
        if (p.fileData) file = { name: p.fileName || "download.zip", size: p.fileSize ?? null };
        await db.product.update({
          where: { id: p.id },
          data: { salesCount: { increment: 1 } },
        });
      }
    } else if (order.itemType === "stock" && order.stockId) {
      const s = await db.stockItem.findUnique({ where: { id: order.stockId } });
      if (s) {
        deliveredContent = `✅ Payment verified on-chain!\n\nItem: ${s.name}\nTx: ${scan.txHash ?? "—"}\nNetwork: ${scan.verificationSource}\n\n--- CREDENTIALS ---\n${formatCredentials(s.credentials)}\n\nStore these safely. Thank you for your purchase!`;
        await db.stockItem.update({
          where: { id: s.id },
          data: { soldCount: { increment: 1 } },
        });
      }
    }

    // --- UPDATE ORDER ---
    const updated = await db.order.update({
      where: { id },
      data: { status: "paid", txHash: scan.txHash, deliveredContent },
    });

    // --- CREATE PAYMENT RECORD ---
    const methodInfo = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod);
    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        blockchain: order.paymentMethod,
        walletAddress: scan.checkedAddress,
        transactionHash: scan.txHash,
        amountReceived: scan.amountReceived,
        confirmations: scan.confirmations,
        verificationSource: scan.verificationSource,
        status: "confirmed",
      },
    }).catch((e) => {
      console.error(`[check] Failed to create Payment record:`, e.message);
      return null;
    });

    console.log(`[check] Order ${order.orderNumber}: Payment record created — ${payment?.id}`);

    // --- INCREMENT STATS ---
    await db.siteStats.upsert({
      where: { id: "singleton" },
      update: { productsSold: { increment: 1 } },
      create: { id: "singleton", productsSold: 1, vouches: 1000 },
    });

    // --- GENERATE INVOICE ---
    const invoiceData: InvoiceData = {
      orderNumber: order.orderNumber,
      customerName: order.buyerDiscord || order.buyerEmail || "Customer",
      customerEmail: order.buyerEmail || "N/A",
      productName: order.itemName,
      amount: order.amount,
      cryptoAmount: order.cryptoAmount,
      cryptocurrency: order.paymentMethod,
      blockchain: methodInfo?.chain || order.paymentMethod,
      transactionHash: scan.txHash || "N/A",
      paymentDate: new Date().toISOString(),
      paymentStatus: "CONFIRMED",
    };
    const invoiceHtml = generateInvoiceHtml(invoiceData);
    const invoiceText = generateInvoiceText(invoiceData);

    // --- SEND EMAIL ---
    let emailSent = false;
    if (order.buyerEmail) {
      try {
        const er = await sendPurchaseEmail(order.buyerEmail, order.itemName, deliveredContent || "");
        emailSent = er.sent;
        if (!er.sent) {
          console.error(`[check] Email send failed:`, er.error);
        }
      } catch (e) {
        console.error(`[check] Email send error:`, e);
      }
    }

    console.log(`[check] Order ${order.orderNumber}: COMPLETE — email=${emailSent}, tx=${scan.txHash}`);

    return NextResponse.json({
      verified: true,
      order: updated,
      delivered: deliveredContent,
      txHash: scan.txHash,
      emailSent,
      emailConfigured: isEmailConfigured(),
      file,
      payment: payment ? {
        blockchain: payment.blockchain,
        transactionHash: payment.transactionHash,
        amountReceived: payment.amountReceived,
        confirmations: payment.confirmations,
        verificationSource: payment.verificationSource,
      } : null,
      message: "Payment verified on-chain! Your purchase has been delivered.",
    });
  } catch (e) {
    console.error(`[check] Fatal error:`, e);
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

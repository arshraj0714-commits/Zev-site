import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPurchaseEmail, isEmailConfigured } from "@/lib/email";
import { scanWalletForPayment } from "@/lib/payments";

// GET /api/orders/cart/[groupId]/check
// Auto-polling endpoint for cart checkout. Called every 8 seconds by the
// checkout modal. Scans the blockchain for the TOTAL crypto amount across
// all orders in the cart group. When found, marks ALL orders as paid and
// delivers all items.
//
// Security: tx-hash dedup EXCLUDES orders in the same cartGroup (so one tx
// can pay for all cart items). Orders in OTHER cart groups or standalone
// orders still can't reuse the same tx.
export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;

    // Get all orders in this cart group
    const cartOrders = await db.order.findMany({
      where: { cartGroup: groupId },
      orderBy: { createdAt: "asc" },
    });

    if (cartOrders.length === 0) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    // Check if all orders are already paid
    const allPaid = cartOrders.every((o) => o.status === "paid");
    if (allPaid) {
      // Return all delivered content
      const deliveries = cartOrders.map((o) => ({
        orderNumber: o.orderNumber,
        itemName: o.itemName,
        txHash: o.txHash,
        deliveredContent: o.deliveredContent,
        orderId: o.id,
        productId: o.productId,
      }));
      return NextResponse.json({
        verified: true,
        deliveries,
        txHash: cartOrders[0].txHash,
        message: "All cart items paid and delivered.",
      });
    }

    // Calculate total crypto amount
    const totalCrypto = cartOrders.reduce((sum, o) => sum + o.cryptoAmount, 0);
    const paymentMethod = cartOrders[0].paymentMethod as "BTC" | "LTC" | "SOL" | "USDT";

    // Collect used tx hashes from all paid orders NOT in this cart group
    // (so the same tx can pay for all cart items, but can't be reused elsewhere)
    const usedTxHashes = new Set<string>();
    const otherPaidOrders = await db.order.findMany({
      where: {
        status: "paid",
        txHash: { not: null },
        cartGroup: { not: groupId },
      },
      select: { txHash: true },
    });
    for (const o of otherPaidOrders) {
      if (o.txHash) usedTxHashes.add(o.txHash);
    }

    // Also collect tx hashes already used by orders IN this cart group that are already paid
    // (in case some orders in the cart were paid individually before — shouldn't happen but safe)
    const cartPaidTxHashes = cartOrders.filter((o) => o.status === "paid" && o.txHash).map((o) => o.txHash!);
    for (const tx of cartPaidTxHashes) {
      usedTxHashes.add(tx);
    }

    // Determine the earliest order creation time (for time filtering)
    const sinceTimestamp = Math.min(...cartOrders.map((o) => o.createdAt.getTime()));

    console.log(`[cart-check] Group ${groupId}: ${cartOrders.length} orders, total ${totalCrypto} ${paymentMethod}, since ${new Date(sinceTimestamp).toISOString()}`);

    // Scan wallet for the total amount
    const scanResult = await scanWalletForPayment(
      paymentMethod,
      totalCrypto,
      sinceTimestamp,
      usedTxHashes,
    );

    if (!scanResult.verified) {
      return NextResponse.json({
        verified: false,
        found: scanResult.found,
        confirmed: scanResult.confirmed,
        amountReceived: scanResult.amountReceived,
        expectedAmount: totalCrypto,
        message: scanResult.found
          ? "Transaction detected — confirming amount..."
          : "Waiting for payment. Send the exact amount to the wallet address.",
      });
    }

    // Payment verified! Mark ALL orders as paid and deliver content.
    console.log(`[cart-check] Payment verified for group ${groupId}! txHash: ${scanResult.txHash}`);

    const deliveries = [];

    for (const order of cartOrders) {
      if (order.status === "paid") {
        // Already paid (shouldn't happen in normal flow, but handle it)
        // Fetch file info for the download button
        const paidProduct = order.productId
          ? await db.product.findUnique({
              where: { id: order.productId },
              select: { fileName: true, fileSize: true, codeLink: true },
            })
          : null;
        deliveries.push({
          orderNumber: order.orderNumber,
          itemName: order.itemName,
          txHash: order.txHash,
          deliveredContent: order.deliveredContent,
          orderId: order.id,
          productId: order.productId,
          fileName: paidProduct?.fileName || null,
          fileSize: paidProduct?.fileSize || null,
          codeLink: paidProduct?.codeLink || null,
        });
        continue;
      }

      // Build delivered content for this product — fetch ALL fields including file info
      const product = order.productId
        ? await db.product.findUnique({
            where: { id: order.productId },
            select: { codeLink: true, type: true, fileName: true, fileSize: true, fileData: true },
          })
        : null;

      let deliveredContent = order.deliveredContent;
      if (!deliveredContent) {
        if (product?.codeLink) {
          deliveredContent = `Code Link: ${product.codeLink}`;
        } else if (product?.fileData) {
          deliveredContent = `Download: Use the download button below to get ${product.fileName || "your file"}.`;
        } else {
          deliveredContent = "Your purchase is complete. Check your email for delivery details.";
        }
      }

      // Update order
      await db.order.update({
        where: { id: order.id },
        data: {
          status: "paid",
          txHash: scanResult.txHash,
          deliveredContent,
        },
      });

      // Increment product sales count
      if (order.productId) {
        await db.product.update({
          where: { id: order.productId },
          data: { salesCount: { increment: 1 } },
        });
      }

      deliveries.push({
        orderNumber: order.orderNumber,
        itemName: order.itemName,
        txHash: scanResult.txHash,
        deliveredContent,
        orderId: order.id,
        productId: order.productId,
        fileName: product?.fileName || null,
        fileSize: product?.fileSize || null,
        codeLink: product?.codeLink || null,
      });
    }

    // Create a single Payment record for the cart (linked to the first order)
    await db.payment.create({
      data: {
        orderId: cartOrders[0].id,
        blockchain: paymentMethod,
        walletAddress: scanResult.checkedAddress,
        transactionHash: scanResult.txHash,
        amountReceived: scanResult.amountReceived,
        confirmations: scanResult.confirmations || 0,
        verificationSource: scanResult.verificationSource,
        status: "confirmed",
      },
    }).catch(() => {
      // Payment record might already exist if the first order was already paid
      console.log("[cart-check] Payment record already exists, skipping");
    });

    // Increment site stats
    await db.siteStats.upsert({
      where: { id: "singleton" },
      update: { productsSold: { increment: cartOrders.length } },
      create: { id: "singleton", productsSold: cartOrders.length, vouches: 1000 },
    });

    // Send purchase email — include all delivered content + download links
    let emailSent = false;
    const buyerEmail = cartOrders[0].buyerEmail;
    if (buyerEmail) {
      try {
        const origin = req.nextUrl.origin;
        const allContent = deliveries
          .map((d, i) => {
            let entry = `${i + 1}. ${d.itemName}\n${d.deliveredContent || ""}`;
            // Add download link if there's an attached file
            if (d.fileName && d.orderId) {
              entry += `\nDownload ${d.fileName}: ${origin}/api/orders/${d.orderId}/download`;
            }
            return entry;
          })
          .join("\n\n---\n\n");
        const emailResult = await sendPurchaseEmail(
          buyerEmail,
          `Cart Purchase (${deliveries.length} items)`,
          allContent
        );
        emailSent = emailResult.sent;
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      verified: true,
      deliveries,
      txHash: scanResult.txHash,
      emailSent,
      emailConfigured: isEmailConfigured(),
      message: "Payment verified! All items delivered.",
    });
  } catch (e) {
    console.error("[cart-check] error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

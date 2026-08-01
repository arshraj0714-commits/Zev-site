import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usdToCrypto, type CryptoMethod } from "@/lib/config";
import { sendPurchaseEmail, isEmailConfigured } from "@/lib/email";
import crypto from "crypto";

// POST /api/orders/cart
// Creates multiple orders grouped under a single cartGroup UUID.
// The user pays ONE crypto transaction for the TOTAL amount.
// Payment verification polls /api/orders/cart/[groupId]/check which
// scans the wallet for the total crypto amount across all orders.
//
// Body: {
//   items: [{ itemId: string, itemType: "product" }],
//   paymentMethod: CryptoMethod,
//   buyerEmail?: string,
//   buyerDiscord?: string,
//   discountCode?: string
// }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, paymentMethod, buyerEmail, buyerDiscord, discountCode } = body as {
      items: { itemId: string; itemType: "product" }[];
      paymentMethod: CryptoMethod;
      buyerEmail?: string;
      buyerDiscord?: string;
      discountCode?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }

    // Look up all products and validate
    const productIds = items.map((i) => i.itemId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true, name: true, price: true, type: true,
        codeLink: true, fileName: true, fileData: true, fileSize: true,
      },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products not found" }, { status: 404 });
    }

    // Check for duplicates in cart
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      return NextResponse.json({ error: "Duplicate items in cart" }, { status: 400 });
    }

    // Calculate total USD amount
    let totalUSD = 0;
    const orderItems: {
      product: typeof products[0];
      usdAmount: number;
      deliveredContent: string | null;
      file: { name: string; size: number | null } | null;
    }[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.itemId);
      if (!product) continue;

      let usdAmount = product.price;
      let deliveredContent: string | null = null;
      let file: { name: string; size: number | null } | null = null;

      if (product.type === "free") {
        deliveredContent = product.codeLink
          ? `FREE PRODUCT — Code Link: ${product.codeLink}`
          : "FREE PRODUCT — No code link provided.";
        if (product.fileData) file = { name: product.fileName || "download.zip", size: product.fileSize ?? null };
        usdAmount = 0;
      }

      totalUSD += usdAmount;
      orderItems.push({ product, usdAmount, deliveredContent, file });
    }

    // Apply discount code if provided and total > 0
    let appliedDiscountPct = 0;
    let appliedDiscountCode: string | null = null;
    if (discountCode && totalUSD > 0) {
      const dc = await db.redeemCode.findUnique({
        where: { code: discountCode.trim().toUpperCase() },
      });
      if (dc && dc.active && dc.usesCount < dc.maxUses && dc.discountPct && dc.discountPct > 0) {
        if (!dc.expiresAt || dc.expiresAt > new Date()) {
          appliedDiscountPct = dc.discountPct;
          appliedDiscountCode = dc.code;
          totalUSD = totalUSD * (1 - appliedDiscountPct / 100);
          console.log(`[cart] Discount applied: ${appliedDiscountPct}% off, new total: $${totalUSD}`);
        }
      }
    }

    // Convert total USD to crypto
    const totalCrypto = totalUSD > 0 ? await usdToCrypto(totalUSD, paymentMethod) : 0;

    // Generate a cart group ID
    const cartGroup = crypto.randomUUID();

    // Generate unique order numbers for each item
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    function generateOrderNumber(): string {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return `ZEV-${code}`;
    }

    async function uniqueOrderNumber(): Promise<string> {
      for (let tries = 0; tries < 10; tries++) {
        const num = generateOrderNumber();
        try {
          const existing = await db.order.findUnique({ where: { orderNumber: num } });
          if (!existing) return num;
        } catch { /* try again */ }
      }
      return `ZEV-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, "0")}`;
    }

    // Create all orders in the cart group
    const isFree = totalUSD === 0;
    const createdOrders = [];

    for (const { product, usdAmount, deliveredContent } of orderItems) {
      const orderNumber = await uniqueOrderNumber();
      const cryptoAmount = isFree ? 0 : await usdToCrypto(usdAmount, paymentMethod);

      const order = await db.order.create({
        data: {
          orderNumber,
          itemType: "product",
          productId: product.id,
          itemName: product.name,
          amount: usdAmount,
          paymentMethod,
          cryptoAmount,
          buyerEmail: buyerEmail || null,
          buyerDiscord: buyerDiscord || null,
          status: isFree ? "paid" : "pending",
          deliveredContent,
          cartGroup,
        },
      });
      createdOrders.push(order);

      // If free, increment stats immediately
      if (isFree) {
        await db.product.update({
          where: { id: product.id },
          data: { salesCount: { increment: 1 } },
        });
      }
    }

    // If free cart, send email and increment stats
    let emailSent = false;
    if (isFree) {
      await db.siteStats.upsert({
        where: { id: "singleton" },
        update: { productsSold: { increment: createdOrders.length } },
        create: { id: "singleton", productsSold: createdOrders.length, vouches: 1000 },
      });

      if (buyerEmail) {
        const origin = req.nextUrl.origin;
        const allContent = orderItems
          .map((oi, i) => {
            const order = createdOrders[i];
            let entry = `${i + 1}. ${oi.product.name}\n${oi.deliveredContent || ""}`;
            if (oi.file && order) {
              entry += `\nDownload ${oi.file.name}: ${origin}/api/orders/${order.id}/download`;
            }
            return entry;
          })
          .join("\n\n---\n\n");
        const emailResult = await sendPurchaseEmail(buyerEmail, `Cart Purchase (${createdOrders.length} items)`, allContent);
        emailSent = emailResult.sent;
      }
    }

    // For free carts, include file info in the response so frontend can show download buttons
    const deliveries = isFree ? createdOrders.map((order, i) => ({
      orderNumber: order.orderNumber,
      itemName: order.itemName,
      deliveredContent: order.deliveredContent,
      orderId: order.id,
      productId: order.productId,
      fileName: orderItems[i]?.file?.name || null,
      fileSize: orderItems[i]?.file?.size || null,
      codeLink: orderItems[i]?.product.codeLink || null,
    })) : [];

    return NextResponse.json({
      cartGroup,
      orders: createdOrders,
      deliveries,
      totalUSD,
      totalCrypto,
      isFree,
      emailSent,
      emailConfigured: isEmailConfigured(),
      files: orderItems.map((oi) => oi.file).filter(Boolean),
    }, { status: 201 });
  } catch (e) {
    console.error("[cart] error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

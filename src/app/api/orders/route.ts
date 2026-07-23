import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usdToCrypto, type CryptoMethod } from "@/lib/config";
import { sendPurchaseEmail, isEmailConfigured } from "@/lib/email";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

// Generate a unique human-readable order number: ZEV-XXXXXX
function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusing chars (I,O,0,1)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ZEV-${code}`;
}

// Guarantees a non-empty, unique order number no matter what — this is a
// required @unique field in the schema, so returning "" or undefined here
// would cause a null constraint violation on insert.
async function uniqueOrderNumber(): Promise<string> {
  for (let tries = 0; tries < 10; tries++) {
    const num = generateOrderNumber();
    try {
      const existing = await db.order.findUnique({ where: { orderNumber: num } });
      if (!existing) return num;
    } catch {
      // DB hiccup on the lookup — fall through and try again
    }
  }
  // Last-resort fallback: timestamp + random suffix, astronomically unlikely to collide
  const fallback = `ZEV-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0")}`;
  return fallback;
}

// GET /api/orders
// - Admin (valid token): returns ALL orders
// - Logged-in user: returns only orders matching their email
// - Query param ?email=xxx for explicit filtering
// - Query param ?search=xxx for searching by orderNumber/itemName/email
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email")?.trim().toLowerCase();
    const search = searchParams.get("search")?.trim().toLowerCase();

    // Check if admin via token
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    const isAdmin = user?.role === "admin";

    // Determine the email filter
    let emailFilter: string | undefined;
    if (isAdmin) {
      // Admin can see all, or filter by email param if provided
      emailFilter = emailParam || undefined;
    } else if (user) {
      // Regular user: only their own orders
      emailFilter = user.email.toLowerCase();
    } else if (emailParam) {
      // Not logged in but provided email (for checkout history lookup)
      emailFilter = emailParam;
    } else {
      // Not logged in, no email → return empty
      return NextResponse.json({ orders: [] });
    }

    // Build where clause
    const where: any = {};
    if (emailFilter) {
      where.buyerEmail = { equals: emailFilter, mode: "insensitive" };
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { itemName: { contains: search, mode: "insensitive" } },
        { buyerEmail: { contains: search, mode: "insensitive" } },
        { txHash: { contains: search, mode: "insensitive" } },
      ];
    }

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: isAdmin ? 200 : 100,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ orders, isAdmin });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/orders — create a pending order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemType, itemId, paymentMethod, buyerEmail, buyerDiscord, discountCode } = body as {
      itemType: "product" | "stock";
      itemId: string;
      paymentMethod: CryptoMethod;
      buyerEmail?: string;
      buyerDiscord?: string;
      discountCode?: string;
    };

    if (!itemType || !itemId || !paymentMethod) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let itemName = "";
    let usdAmount = 0;
    let deliveredContent: string | null = null;
    let file: { name: string; size: number | null } | null = null;

    if (itemType === "product") {
      const p = await db.product.findUnique({ where: { id: itemId } });
      if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      if (p.type === "free") {
        deliveredContent = p.codeLink
          ? `FREE PRODUCT — Code Link: ${p.codeLink}`
          : "FREE PRODUCT — No code link provided.";
        if (p.fileData) file = { name: p.fileName || "download.zip", size: p.fileSize ?? null };
        itemName = p.name;
        usdAmount = 0;
      } else {
        itemName = p.name;
        usdAmount = p.price;
      }
    } else if (itemType === "stock") {
      const s = await db.stockItem.findUnique({ where: { id: itemId } });
      if (!s) return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
      if (s.quantity - s.soldCount <= 0) {
        return NextResponse.json({ error: "Item out of stock" }, { status: 400 });
      }
      itemName = s.name;
      usdAmount = s.price;
    } else {
      return NextResponse.json({ error: "Invalid itemType" }, { status: 400 });
    }

    // Apply discount code if provided
    let appliedDiscountPct = 0;
    let appliedDiscountCode: string | null = null;
    if (discountCode && usdAmount > 0) {
      const dc = await db.redeemCode.findUnique({
        where: { code: discountCode.trim().toUpperCase() },
      });
      if (dc && dc.active && dc.usesCount < dc.maxUses && dc.discountPct && dc.discountPct > 0) {
        if (!dc.expiresAt || dc.expiresAt > new Date()) {
          appliedDiscountPct = dc.discountPct;
          appliedDiscountCode = dc.code;
          usdAmount = usdAmount * (1 - appliedDiscountPct / 100);
          console.log(`[orders] Discount applied: ${appliedDiscountPct}% off, new amount: $${usdAmount}`);
        }
      }
    }

    const cryptoAmount = usdAmount > 0 ? await usdToCrypto(usdAmount, paymentMethod) : 0;

    // Guaranteed non-empty — required @unique field on Order.
    const orderNumber = await uniqueOrderNumber();
    if (!orderNumber) {
      // This should be unreachable given the fallback above, but fail loudly
      // instead of hitting a confusing DB constraint error if it ever is.
      return NextResponse.json({ error: "Failed to generate order number" }, { status: 500 });
    }

    const order = await db.order.create({
      data: {
        orderNumber,
        itemType,
        productId: itemType === "product" ? itemId : null,
        stockId: itemType === "stock" ? itemId : null,
        itemName,
        amount: usdAmount,
        paymentMethod,
        cryptoAmount,
        buyerEmail: buyerEmail || null,
        buyerDiscord: buyerDiscord || null,
        status: usdAmount === 0 ? "paid" : "pending",
        deliveredContent,
      },
    });

    // If free, increment stats & sales immediately + send email
    let emailSent = false;
    if (usdAmount === 0) {
      await db.siteStats.upsert({
        where: { id: "singleton" },
        update: { productsSold: { increment: 1 } },
        create: { id: "singleton", productsSold: 1, vouches: 1000 },
      });
      if (itemType === "product") {
        await db.product.update({ where: { id: itemId }, data: { salesCount: { increment: 1 } } });
      }
      if (buyerEmail && deliveredContent) {
        const emailResult = await sendPurchaseEmail(buyerEmail, itemName, deliveredContent);
        emailSent = emailResult.sent;
      }
    }

    return NextResponse.json({ order, emailSent, emailConfigured: isEmailConfigured(), file }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

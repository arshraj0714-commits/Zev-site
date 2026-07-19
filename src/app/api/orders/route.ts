import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usdToCrypto, type CryptoMethod } from "@/lib/config";

// GET /api/orders  (list recent, for admin panel)
export async function GET() {
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/orders  — create a pending order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemType, itemId, paymentMethod, buyerEmail, buyerDiscord } = body as {
      itemType: "product" | "stock";
      itemId: string;
      paymentMethod: CryptoMethod;
      buyerEmail?: string;
      buyerDiscord?: string;
    };

    if (!itemType || !itemId || !paymentMethod) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let itemName = "";
    let usdAmount = 0;
    let deliveredContent: string | null = null;

    if (itemType === "product") {
      const p = await db.product.findUnique({ where: { id: itemId } });
      if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      if (p.type === "free") {
        // free product — deliver immediately
        deliveredContent = p.codeLink
          ? `FREE PRODUCT — Code Link: ${p.codeLink}`
          : "FREE PRODUCT — No code link provided.";
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

    const cryptoAmount = usdAmount > 0 ? await usdToCrypto(usdAmount, paymentMethod) : 0;

    const order = await db.order.create({
      data: {
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

    // If free, increment stats & sales immediately
    if (usdAmount === 0) {
      await db.siteStats.upsert({
        where: { id: "singleton" },
        update: { productsSold: { increment: 1 } },
        create: { id: "singleton", productsSold: 1, vouches: 1000 },
      });
      if (itemType === "product") {
        await db.product.update({ where: { id: itemId }, data: { salesCount: { increment: 1 } } });
      }
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

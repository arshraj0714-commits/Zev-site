import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

// GET /api/redeem — list all active redeem codes (for home banners + dashboard)
export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    const isAdmin = user?.role === "admin";

    const where = isAdmin ? {} : { active: true };
    const codes = await db.redeemCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        description: true,
        rewardType: true,
        rewardName: true,
        maxUses: true,
        usesCount: true,
        expiresAt: true,
        active: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ codes, isAdmin });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/redeem — user redeems a code
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    if (!user) return NextResponse.json({ error: "You must be signed in to redeem a code" }, { status: 401 });

    const redeemCode = await db.redeemCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!redeemCode) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }
    if (!redeemCode.active) {
      return NextResponse.json({ error: "This code is no longer active" }, { status: 400 });
    }
    if (redeemCode.usesCount >= redeemCode.maxUses) {
      return NextResponse.json({ error: "This code has reached its maximum uses" }, { status: 400 });
    }
    if (redeemCode.expiresAt && redeemCode.expiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired" }, { status: 400 });
    }

    // Increment use count
    const updated = await db.redeemCode.update({
      where: { id: redeemCode.id },
      data: { usesCount: { increment: 1 } },
    });

    // If max uses reached, auto-deactivate
    if (updated.usesCount >= updated.maxUses) {
      await db.redeemCode.update({
        where: { id: redeemCode.id },
        data: { active: false },
      });
    }

    // Deliver the reward
    let deliveredContent = "";
    if (redeemCode.rewardType === "product" && redeemCode.rewardId) {
      const p = await db.product.findUnique({ where: { id: redeemCode.rewardId } });
      if (p) {
        deliveredContent = p.codeLink
          ? `🎁 Redeemed: ${p.name}\nCode Link: ${p.codeLink}\n\nThank you for using Zev!`
          : `🎁 Redeemed: ${p.name}\n\nContact support if you need access.`;
      }
    } else if (redeemCode.rewardType === "stock" && redeemCode.rewardId) {
      const s = await db.stockItem.findUnique({ where: { id: redeemCode.rewardId } });
      if (s) {
        const creds = formatCredentials(s.credentials);
        deliveredContent = `🎁 Redeemed: ${s.name}\n\n--- CREDENTIALS ---\n${creds}\n\nStore these safely!`;
      }
    } else {
      deliveredContent = `🎁 Code redeemed successfully!\n\nReward: ${redeemCode.rewardName || "Special bonus"}\n\nThank you for using Zev!`;
    }

    // Create an order record for this redemption
    await db.order.create({
      data: {
        orderNumber: `ZEV-REDEEM-${Date.now().toString(36).toUpperCase()}`,
        itemType: "product",
        itemName: `Redeemed: ${redeemCode.rewardName || redeemCode.description || "Reward"}`,
        amount: 0,
        paymentMethod: "REDEEM",
        cryptoAmount: 0,
        buyerEmail: user.email,
        status: "paid",
        deliveredContent,
      },
    });

    return NextResponse.json({
      success: true,
      reward: redeemCode.rewardName || redeemCode.description || "Reward",
      delivered: deliveredContent,
      message: "Code redeemed successfully!",
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
    return String(arr);
  } catch {
    return raw;
  }
}

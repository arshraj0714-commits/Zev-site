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
        rewardLink: true,
        discountPct: true,
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
// A single user can ONLY redeem a code ONCE. Second attempt = "Code Already Redeemed!"
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    if (!user) return NextResponse.json({ error: "You must be signed in to redeem a code" }, { status: 401 });

    const userEmail = user.email.toLowerCase().trim();
    const codeUpper = code.trim().toUpperCase();

    const redeemCode = await db.redeemCode.findUnique({
      where: { code: codeUpper },
    });

    if (!redeemCode) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    // --- DUPLICATE CHECK: Has this email already redeemed THIS code? ---
    // Search ALL orders from this user with paymentMethod=REDEEM that mention this code
    const existingOrders = await db.order.findMany({
      where: {
        buyerEmail: userEmail,
        paymentMethod: "REDEEM",
        status: "paid",
      },
      select: { itemName: true, deliveredContent: true },
    });

    // Check each order to see if it was for THIS code
    for (const order of existingOrders) {
      const text = (order.itemName + " " + (order.deliveredContent || "")).toUpperCase();
      if (text.includes(`[${codeUpper}]`) || text.includes(`CODE REDEEMED: ${codeUpper}`) || text.includes(`REDEEMED [${codeUpper}]`)) {
        return NextResponse.json({
          error: "Code Already Redeemed! You have already used this code. Each code can only be redeemed once per user.",
        }, { status: 400 });
      }
    }

    // --- VALIDATION CHECKS ---
    if (!redeemCode.active) {
      return NextResponse.json({ error: "This code has already been fully redeemed and is no longer active." }, { status: 400 });
    }
    if (redeemCode.usesCount >= redeemCode.maxUses) {
      return NextResponse.json({ error: "This code has reached its maximum uses and can no longer be redeemed." }, { status: 400 });
    }
    if (redeemCode.expiresAt && redeemCode.expiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired." }, { status: 400 });
    }

    // --- INCREMENT USE COUNT ---
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

    // --- BUILD DELIVERED CONTENT ---
    let deliveredContent = "";
    const rewardName = redeemCode.rewardName || redeemCode.description || "Reward";

    if (redeemCode.discountPct && redeemCode.discountPct > 0) {
      deliveredContent = `Code Redeemed: ${redeemCode.code}\n\nReward: ${rewardName}\nDiscount: ${redeemCode.discountPct}% off your next order!\n\nUse this code at checkout to get ${redeemCode.discountPct}% off any product.\n\nThank you for using Zev!`;
    } else if (redeemCode.rewardLink) {
      deliveredContent = `Code Redeemed: ${redeemCode.code}\n\nReward: ${rewardName}\n\nAccess Link: ${redeemCode.rewardLink}\n\nThank you for using Zev!`;
    } else if (redeemCode.rewardType === "product" && redeemCode.rewardId) {
      const p = await db.product.findUnique({ where: { id: redeemCode.rewardId } });
      if (p) {
        deliveredContent = p.codeLink
          ? `Code Redeemed: ${redeemCode.code}\n\nReward: ${p.name}\nCode Link: ${p.codeLink}\n\nThank you for using Zev!`
          : `Code Redeemed: ${redeemCode.code}\n\nReward: ${p.name}\n\nContact support if you need access.`;
      } else {
        deliveredContent = `Code Redeemed: ${redeemCode.code}\n\nReward: ${rewardName}\n\nThank you for using Zev!`;
      }
    } else if (redeemCode.rewardType === "stock" && redeemCode.rewardId) {
      const s = await db.stockItem.findUnique({ where: { id: redeemCode.rewardId } });
      if (s) {
        const creds = formatCredentials(s.credentials);
        deliveredContent = `Code Redeemed: ${redeemCode.code}\n\nReward: ${s.name}\n\n--- CREDENTIALS ---\n${creds}\n\nStore these safely!`;
      } else {
        deliveredContent = `Code Redeemed: ${redeemCode.code}\n\nReward: ${rewardName}\n\nThank you for using Zev!`;
      }
    } else {
      deliveredContent = `Code Redeemed: ${redeemCode.code}\n\nReward: ${rewardName}\n${redeemCode.description ? `\n${redeemCode.description}\n` : ""}\nThank you for using Zev!`;
    }

    // --- CREATE ORDER RECORD ---
    // The itemName MUST contain the code in [BRACKETS] so the duplicate check can find it
    await db.order.create({
      data: {
        orderNumber: `ZEV-REDEEM-${Date.now().toString(36).toUpperCase()}`,
        itemType: "product",
        itemName: `Redeemed [${redeemCode.code}]: ${rewardName}`,
        amount: 0,
        paymentMethod: "REDEEM",
        cryptoAmount: 0,
        buyerEmail: userEmail,
        status: "paid",
        deliveredContent,
      },
    });

    return NextResponse.json({
      success: true,
      reward: rewardName,
      discountPct: redeemCode.discountPct || 0,
      rewardLink: redeemCode.rewardLink || null,
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

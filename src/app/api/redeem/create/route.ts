import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

// POST /api/redeem/create — admin creates a new redeem code
// Fields: code, description, rewardType, rewardName, rewardLink, discountPct, maxUses, expiresAt
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const {
      code, description, rewardType, rewardName, rewardLink, discountPct, maxUses, expiresAt,
    } = await req.json();

    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });
    if (!rewardType) return NextResponse.json({ error: "Reward type is required" }, { status: 400 });

    const codeUpper = code.trim().toUpperCase();

    // Check if code already exists
    const existing = await db.redeemCode.findUnique({ where: { code: codeUpper } });
    if (existing) {
      return NextResponse.json({ error: "A code with this name already exists" }, { status: 409 });
    }

    // Validate discount percentage
    let discount: number | null = null;
    if (discountPct !== undefined && discountPct !== null && discountPct !== "") {
      discount = Number(discountPct);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
      }
    }

    const redeemCode = await db.redeemCode.create({
      data: {
        code: codeUpper,
        description: description || null,
        rewardType,
        rewardName: rewardName || null,
        rewardLink: rewardLink || null,
        discountPct: discount,
        maxUses: Number(maxUses) || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        active: true,
      },
    });

    return NextResponse.json({ redeemCode }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/redeem/create?id=xxx — admin deletes a redeem code
export async function DELETE(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    await db.redeemCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

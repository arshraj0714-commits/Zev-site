import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifyToken, toAppUser } from "@/lib/auth";

// POST /api/auth/accept-tos — marks the user as having accepted the TOS
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const updated = await db.user.update({
      where: { id: user.id },
      data: { tosAccepted: true },
    });

    const appUser = toAppUser(updated);
    // Include tosAccepted in the returned user
    const userWithTos = { ...appUser, tosAccepted: true };

    return NextResponse.json({
      user: userWithTos,
      message: "Terms of Service accepted!",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

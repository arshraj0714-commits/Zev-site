import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifyToken, hashPassword, verifyPassword } from "@/lib/auth";

// POST /api/auth/change-password — change password (requires current password)
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    // Verify current password
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !verifyPassword(currentPassword, dbUser.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return NextResponse.json({ message: "Password changed successfully!" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

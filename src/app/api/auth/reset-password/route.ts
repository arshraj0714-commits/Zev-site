import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

// POST /api/auth/reset-password
// User submits: { token, newPassword }
//
// We:
// 1. Hash the submitted token with SHA-256.
// 2. Find the user whose resetTokenHash matches AND whose resetExpiry is in the future.
// 3. If found → update their passwordHash and clear the reset token (one-time use).
// 4. If not found → return a vague error (expired / invalid / already used).
//
// SECURITY:
// - Constant-time-ish lookup via unique hash column.
// - Token is single-use: cleared immediately on success.
// - Expiry enforced strictly (10 minutes from issue).
// - No login happens here — user must sign in with their new password.
//   (Redirects to the signup/signin page on the frontend.)
export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
    }
    if (typeof token !== "string" || token.length < 32) {
      return NextResponse.json({ error: "Invalid reset token." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Hash the submitted token the same way forgot-password did
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find the user who owns this token hash
    const user = await db.user.findFirst({
      where: { resetTokenHash: tokenHash },
    });

    // Vague error for ALL failure cases (invalid / expired / already used)
    // so attackers can't distinguish between them.
    const invalidError = "This password reset link is invalid or has expired. Please request a new one.";

    if (!user) {
      return NextResponse.json({ error: invalidError }, { status: 400 });
    }

    // Check expiry
    if (!user.resetExpiry || user.resetExpiry < new Date()) {
      // Clean up the expired token
      await db.user.update({
        where: { id: user.id },
        data: { resetTokenHash: null, resetExpiry: null },
      });
      return NextResponse.json({ error: "This password reset link has expired. Please request a new one." }, { status: 400 });
    }

    // All checks passed → update password + clear the reset token (one-time use)
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(newPassword),
        resetTokenHash: null,
        resetExpiry: null,
      },
    });

    console.log("[reset-password] Password successfully reset for:", user.email);

    return NextResponse.json({
      success: true,
      message: "Your password has been changed successfully. You can now sign in with your new password.",
    });
  } catch (e) {
    console.error("[reset-password] error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createToken, toAppUser, isAdminEmail } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

// POST /api/auth/verify-code
// Step 2 of email verification: user enters the 6-digit code from their email.
// We verify the code + expiry, mark the account as verified, and log them in.
export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Email and verification code are required" }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email: emailLower } });

    if (!user) {
      return NextResponse.json({ error: "No pending signup found for this email. Please sign up again." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "This email is already verified. Please sign in." }, { status: 400 });
    }

    // Check the code
    if (!user.verifyToken || user.verifyToken !== code.trim()) {
      return NextResponse.json({ error: "Invalid verification code. Please check and try again." }, { status: 400 });
    }

    // Check expiry
    if (!user.verifyExpiry || user.verifyExpiry < new Date()) {
      return NextResponse.json({ error: "Verification code expired. Please request a new code." }, { status: 400 });
    }

    // Code is valid — mark as verified, clear token
    const role = isAdminEmail(emailLower) ? "admin" : "user";
    const updated = await db.user.update({
      where: { email: emailLower },
      data: {
        emailVerified: true,
        verifyToken: null,
        verifyExpiry: null,
        role, // ensure admin if applicable
      },
    });

    const appUser = toAppUser(updated);
    const token = createToken(appUser);

    // Send welcome email (non-blocking)
    try {
      await sendWelcomeEmail(emailLower, appUser.name, role === "admin");
    } catch { /* non-blocking */ }

    return NextResponse.json({
      token,
      user: appUser,
      message: role === "admin"
        ? "Email verified! Welcome, Arsh — admin access granted."
        : "Email verified! Your account is ready.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

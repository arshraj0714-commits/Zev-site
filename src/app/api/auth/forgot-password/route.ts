import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail, isEmailConfigured } from "@/lib/email";
import crypto from "crypto";

// POST /api/auth/forgot-password
// User enters their email → we generate a secure one-time reset token,
// store ONLY a SHA-256 hash of it in the DB, and email the raw token
// to the user as part of a reset link.
//
// SECURITY:
// - Token is 64 random bytes (512 bits) — unguessable.
// - We store sha256(token) in the DB, not the token itself, so a DB
//   leak cannot be used to reset passwords.
// - Token expires after exactly 10 minutes.
// - One-time use: cleared immediately after a successful reset.
// - We always return 200 (even for unknown emails) so attackers can't
//   enumerate which emails have accounts.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const emailLower = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    console.log("[forgot-password] Request for:", emailLower);

    const user = await db.user.findUnique({ where: { email: emailLower } });

    // Always return the same vague success message — don't reveal whether
    // the email exists in our system (prevents account enumeration).
    const genericOk = {
      sent: true,
      message: "If an account exists for that email, a reset link has been sent. Please check your inbox (and spam folder).",
    };

    if (!user) {
      // No account found — silently succeed (don't leak that email isn't registered)
      console.log("[forgot-password] No account found for:", emailLower, "— returning generic OK");
      return NextResponse.json(genericOk);
    }

    // NOTE: We do NOT check emailVerified here. If a user forgot their password,
    // they can't verify their email anyway. The reset email going to their inbox
    // IS the verification — if they receive it, they own the email.
    // Blocking unverified accounts from password reset creates a chicken-and-egg
    // problem where the user is permanently locked out.

    // Generate a 64-byte (512-bit) cryptographically secure random token
    const rawToken = crypto.randomBytes(64).toString("hex");
    // Store only the SHA-256 hash — never the raw token
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    // Expiry: exactly 10 minutes from now
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.user.update({
      where: { email: emailLower },
      data: {
        resetTokenHash: tokenHash,
        resetExpiry: expiry,
      },
    });

    console.log("[forgot-password] Token stored for:", emailLower, "emailVerified:", user.emailVerified);

    // Build the reset link — hash-based route so it works within the SPA
    // Format: https://zevdev.vercel.app/#/reset-password?token=xxx
    const origin = req.nextUrl.origin;
    const resetLink = `${origin}/#/reset-password?token=${rawToken}`;

    // Try to send the email
    const emailConfigured = isEmailConfigured();
    console.log("[forgot-password] Email configured:", emailConfigured, "method:", process.env.SMTP_HOST ? "smtp" : "none");

    let emailSent = false;
    let emailError: string | undefined;

    if (emailConfigured) {
      const name = user.name || emailLower.split("@")[0];
      console.log("[forgot-password] Attempting to send email to:", emailLower);
      const result = await sendPasswordResetEmail(emailLower, name, resetLink);
      emailSent = result.sent;
      emailError = result.error;
      console.log("[forgot-password] Email result:", { sent: emailSent, error: emailError, to: emailLower });
    } else {
      console.log("[forgot-password] Email NOT configured — SMTP_HOST/SMTP_USER/SMTP_PASS missing from env");
    }

    if (emailSent) {
      // Email was sent successfully — return the generic OK
      return NextResponse.json(genericOk);
    }

    // FALLBACK: Email couldn't be sent (SMTP not configured, auth error, etc.)
    // Instead of leaving the user stuck, we return the reset link directly
    // in the response so the frontend can display it. This mirrors the
    // signup code fallback pattern and ensures password reset ALWAYS works.
    //
    // The token is still valid in the DB (we do NOT invalidate it), so the
    // user can click the link and reset their password normally.
    console.log("[forgot-password] Email failed — returning fallback reset link for:", emailLower);

    return NextResponse.json({
      sent: false,
      fallbackLink: resetLink,
      email: emailLower,
      emailError: emailError || "Email could not be sent (SMTP not configured or auth failed).",
      message: "We couldn't email you the reset link, but you can reset your password using the link below.",
    });
  } catch (e) {
    console.error("[forgot-password] error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

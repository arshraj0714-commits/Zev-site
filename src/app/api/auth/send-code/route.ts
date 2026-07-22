import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendVerificationEmail, isEmailConfigured } from "@/lib/email";

// POST /api/auth/send-code
// Step 1 of email verification: user enters email + password + name on signup,
// we send a 6-digit code to their email. The code is stored in a temporary
// "pending signup" record (using the User table with emailVerified=false).
//
// FALLBACK: If email sending fails (SMTP not configured, auth error, etc.),
// we return the code in the response so the frontend can display it.
// This ensures signup ALWAYS works, even without email configured.
export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    const emailLower = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    // Check if email is already registered AND verified
    const existing = await db.user.findUnique({ where: { email: emailLower } });
    if (existing && existing.emailVerified) {
      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the password now (so we don't store plaintext even temporarily)
    const { hashPassword } = await import("@/lib/auth");
    const passwordHash = hashPassword(password);

    // Expiry: 10 minutes from now
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    // Upsert: if there's an existing unverified record for this email, update it
    if (existing && !existing.emailVerified) {
      await db.user.update({
        where: { email: emailLower },
        data: {
          passwordHash,
          name: name || emailLower.split("@")[0],
          verifyToken: code,
          verifyExpiry: expiry,
        },
      });
    } else {
      await db.user.create({
        data: {
          email: emailLower,
          passwordHash,
          name: name || emailLower.split("@")[0],
          emailVerified: false,
          verifyToken: code,
          verifyExpiry: expiry,
        },
      });
    }

    // Try to send the verification email
    const emailConfigured = isEmailConfigured();
    let emailSent = false;
    let emailError: string | undefined;

    if (emailConfigured) {
      const emailResult = await sendVerificationEmail(emailLower, code);
      emailSent = emailResult.sent;
      emailError = emailResult.error;
    }

    if (emailSent) {
      // Email sent successfully — user checks their inbox
      return NextResponse.json({
        sent: true,
        email: emailLower,
        message: "Verification code sent! Check your email inbox.",
      });
    }

    // FALLBACK: Email failed or not configured — return the code so the
    // frontend can display it on screen. Signup still works!
    return NextResponse.json({
      sent: false,
      email: emailLower,
      fallbackCode: code,
      message: "Email could not be sent. Your verification code is shown below.",
      emailError: emailError || "Email not configured. Visit /api/email-test to debug.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

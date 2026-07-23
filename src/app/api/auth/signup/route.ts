import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail, createToken, toAppUser, isAdminEmail } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

// POST /api/auth/signup — simple signup (no email verification)
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

    const existing = await findUserByEmail(emailLower);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    }

    const user = await createUser(emailLower, password, name);
    const appUser = toAppUser(user);
    const token = createToken(appUser);
    const admin = isAdminEmail(emailLower);

    // Try to send welcome email (non-blocking)
    let emailSent = false;
    try {
      const result = await sendWelcomeEmail(emailLower, appUser.name, admin);
      emailSent = result.sent;
    } catch { /* non-blocking */ }

    return NextResponse.json({
      token,
      user: appUser,
      emailSent,
      message: admin
        ? "Welcome, Arsh! Admin access granted."
        : "Account created successfully!",
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

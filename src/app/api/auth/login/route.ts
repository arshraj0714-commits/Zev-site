import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, verifyPassword, createToken, toAppUser, isAdminEmail, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendLoginEmail } from "@/lib/email";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    let user = await findUserByEmail(emailLower);

    // Backward-compat: if Arsh's owner email has no DB account yet but the
    // legacy owner password is supplied, auto-provision the admin account.
    if (!user && isAdminEmail(emailLower)) {
      const ADMIN_LEGACY_PASS = "@rsh0712";
      if (password === ADMIN_LEGACY_PASS) {
        user = await db.user.create({
          data: {
            email: emailLower,
            passwordHash: hashPassword(password),
            name: "Arsh Raj Sharma",
            role: "admin",
          },
        });
      }
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const appUser = toAppUser(user);
    const token = createToken(appUser);

    // Send login notification email (non-blocking)
    let emailSent = false;
    try {
      const result = await sendLoginEmail(emailLower, appUser.name);
      emailSent = result.sent;
    } catch { /* don't block login */ }

    return NextResponse.json({
      token,
      user: appUser,
      emailSent,
      message: isAdminEmail(emailLower)
        ? "Welcome back, Arsh!"
        : "Signed in successfully!",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

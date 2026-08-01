import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/auth/signup — now just checks if email is available for signup
// The actual account creation happens in /api/auth/verify-code after email verification
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
    const existing = await findUserByEmail(emailLower);
    if (existing && existing.emailVerified) {
      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    }

    // Email is available — tell the frontend to proceed to send-code
    return NextResponse.json({
      available: true,
      message: "Email available. Proceed to send verification code.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

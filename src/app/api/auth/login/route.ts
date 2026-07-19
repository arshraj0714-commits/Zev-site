import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, createToken, ADMIN_USER } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (!verifyCredentials(email, password)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const token = createToken(ADMIN_USER);
    return NextResponse.json({
      token,
      user: ADMIN_USER,
      message: "Welcome back, Arsh!",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

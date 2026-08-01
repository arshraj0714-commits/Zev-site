import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createToken, toAppUser, isAdminEmail, hashPassword } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

// GET /api/auth/google
// Initiates Google OAuth flow — redirects user to Google's consent screen.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env" },
      { status: 500 }
    );
  }

  // Build the redirect URI — must match what's in Google Cloud Console
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // State param prevents CSRF — we use a random string
  const state = Math.random().toString(36).substring(2, 15);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}

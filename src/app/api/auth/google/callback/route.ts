import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createToken, toAppUser, isAdminEmail, hashPassword } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

// GET /api/auth/google/callback
// Google redirects here after the user consents. We exchange the code for
// tokens, fetch the user's profile, then either log them in or create an account.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/#/auth?error=${encodeURIComponent(error)}`, req.nextUrl.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/#/auth?error=no_code", req.nextUrl.origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/#/auth?error=oauth_not_configured", req.nextUrl.origin));
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // 1. Exchange code for access token
  let accessToken: string | null = null;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[Google OAuth] token exchange failed:", errBody);
      return NextResponse.redirect(new URL("/#/auth?error=token_exchange_failed", req.nextUrl.origin));
    }
    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
  } catch (e) {
    console.error("[Google OAuth] token exchange error:", e);
    return NextResponse.redirect(new URL("/#/auth?error=token_exchange_error", req.nextUrl.origin));
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL("/#/auth?error=no_access_token", req.nextUrl.origin));
  }

  // 2. Fetch user profile from Google
  let googleUser: { email: string; name: string; sub: string } | null = null;
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      return NextResponse.redirect(new URL("/#/auth?error=profile_fetch_failed", req.nextUrl.origin));
    }
    const profile = await profileRes.json();
    googleUser = {
      email: profile.email?.toLowerCase() || "",
      name: profile.name || profile.email?.split("@")[0] || "User",
      sub: profile.sub,
    };
  } catch (e) {
    console.error("[Google OAuth] profile fetch error:", e);
    return NextResponse.redirect(new URL("/#/auth?error=profile_fetch_error", req.nextUrl.origin));
  }

  if (!googleUser?.email) {
    return NextResponse.redirect(new URL("/#/auth?error=no_email", req.nextUrl.origin));
  }

  // 3. Find or create the user in our DB
  const emailLower = googleUser.email.toLowerCase();
  let user = await db.user.findUnique({ where: { email: emailLower } });
  let isNewUser = false;

  if (!user) {
    // Create a new account — Google users get a random password (they auth via Google)
    const randomPass = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const role = isAdminEmail(emailLower) ? "admin" : "user";
    user = await db.user.create({
      data: {
        email: emailLower,
        passwordHash: hashPassword(randomPass),
        name: googleUser.name,
        role,
      },
    });
    isNewUser = true;
  }

  const appUser = toAppUser(user);
  const token = createToken(appUser);

  // 4. Send welcome email for new users
  if (isNewUser) {
    try {
      await sendWelcomeEmail(emailLower, appUser.name, appUser.role === "admin");
    } catch { /* non-blocking */ }
  }

  // 5. Redirect to frontend with token in URL hash (so the SPA can pick it up)
  // We put it in the hash fragment so it's NOT sent to the server on subsequent requests.
  const admin = appUser.role === "admin";
  const redirectPath = admin ? "/#/upload" : "/#/home";
  const redirectUrl = new URL(
    `${redirectPath}?google_token=${encodeURIComponent(token)}&google_user=${encodeURIComponent(JSON.stringify(appUser))}`,
    req.nextUrl.origin
  );
  return NextResponse.redirect(redirectUrl);
}

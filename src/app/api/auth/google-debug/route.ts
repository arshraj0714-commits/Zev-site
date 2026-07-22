import { NextRequest, NextResponse } from "next/server";

// GET /api/auth/google-debug
// Shows the exact redirect URI you need to add to Google Cloud Console.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return NextResponse.json({
    step1: "Go to https://console.cloud.google.com/apis/credentials",
    step2: "Click your OAuth 2.0 Client ID",
    step3: "Under 'Authorized redirect URIs', add this EXACT URL:",
    redirectUri,
    step4: "Under 'Authorized JavaScript origins', add this:",
    javascriptOrigin: origin,
    step5: "Save and wait 5 minutes for Google to propagate",
    config: {
      clientId: clientId ? `${clientId.substring(0, 20)}...` : "(not set)",
      clientSecret: clientSecret ? "(set, hidden)" : "(not set)",
      redirectUri,
      javascriptOrigin: origin,
    },
    note: "Make sure the redirect URI matches EXACTLY - including https://, trailing slash, etc.",
  });
}

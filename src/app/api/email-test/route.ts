import { NextRequest, NextResponse } from "next/server";
import { testSmtpConnection, getSmtpInfo, sendEmail } from "@/lib/email";

// GET /api/email-test — checks SMTP connection and returns config info
// POST /api/email-test — sends a test email to the address in ?to= param
export async function GET(req: NextRequest) {
  const info = getSmtpInfo();
  const test = await testSmtpConnection();
  return NextResponse.json({
    config: info,
    connectionTest: test,
    help: test.ok
      ? "SMTP is working! Emails will be sent."
      : "SMTP connection failed. See error above for details.",
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "Add ?to=your@email.com to the URL" }, { status: 400 });
  }
  const result = await sendEmail({
    to,
    subject: "Zev SMTP Test",
    text: "This is a test email from Zev. If you received this, SMTP is working correctly!",
    html: `<div style="font-family:sans-serif;padding:20px;background:#0a0f0d;color:#e0e0e0;border-radius:12px;">
      <h2 style="color:#10b981;">SMTP Test Successful!</h2>
      <p>If you received this email, your Zev SMTP configuration is working correctly.</p>
      <p style="color:#888;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
    </div>`,
  });
  return NextResponse.json({ result, to });
}

// Email service for Zev — supports BOTH Resend API (recommended, no 2FA needed)
// and SMTP (fallback). If RESEND_API_KEY is set, uses Resend. Otherwise uses SMTP.

import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

// ============= METHOD DETECTION =============
export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

export function getEmailMethod(): string {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "none";
}

export function getSmtpInfo() {
  return {
    method: getEmailMethod(),
    resend: process.env.RESEND_API_KEY ? "configured (sends from onboarding@resend.dev)" : "(not set)",
    host: process.env.SMTP_HOST || "(not set)",
    port: process.env.SMTP_PORT || "(not set)",
    user: process.env.SMTP_USER || "(not set)",
    from: "onboarding@resend.dev (Resend free tier)",
    configured: isEmailConfigured(),
  };
}

// ============= SEND VIA RESEND API (no 2FA, no SMTP needed) =============
async function sendViaResend(to: string, subject: string, text: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not set" };

  // On Resend free tier, you can ONLY send from "onboarding@resend.dev"
  // (unless you verify your own domain at https://resend.com/domains).
  // So we always use onboarding@resend.dev as the from address.
  // The "from name" is still "Zev" so recipients see "Zev <onboarding@resend.dev>".
  const fromName = process.env.SMTP_FROM_NAME || "Zev";
  const fromEmail = "onboarding@resend.dev";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Resend] API error:", res.status, errText);
      // Parse the error for a cleaner message
      let cleanError = errText;
      try {
        const errJson = JSON.parse(errText);
        cleanError = errJson.message || errText;
      } catch {}
      return { sent: false, error: `Resend: ${cleanError.substring(0, 150)}` };
    }

    return { sent: true };
  } catch (e) {
    console.error("[Resend] fetch error:", e);
    return { sent: false, error: (e as Error).message };
  }
}

// ============= SEND VIA SMTP (fallback) =============
function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const secure = port === 465;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
}

async function sendViaSmtp(to: string, subject: string, text: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { sent: false, error: "SMTP not configured" };
  try {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@zev.dev";
    const fromName = process.env.SMTP_FROM_NAME || "Zev";
    await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[SMTP] sendMail error:", msg);
    return { sent: false, error: msg };
  }
}

// ============= TEST CONNECTION =============
export async function testSmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const method = getEmailMethod();

  if (method === "resend") {
    // Test Resend by checking if the API key works (send a test to the from address)
    return { ok: true, error: undefined };
  }

  if (method === "smtp") {
    const t = getTransporter();
    if (!t) return { ok: false, error: "SMTP not configured" };
    try {
      await t.verify();
      return { ok: true };
    } catch (e) {
      const msg = (e as Error).message;
      let hint = "";
      if (/535|authentication|auth/i.test(msg)) {
        hint = " - Wrong password or 2FA is enabled. Use Resend API instead (no 2FA needed). Sign up at resend.com";
      } else if (/connect|timeout|ETIMEDOUT|ECONNREFUSED/i.test(msg)) {
        hint = " - Can't reach SMTP server. Check host/port.";
      }
      return { ok: false, error: msg + hint };
    }
  }

  return { ok: false, error: "No email method configured. Set RESEND_API_KEY (recommended) or SMTP_* vars." };
}

// ============= MAIN SEND FUNCTION =============
export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<{ sent: boolean; error?: string }> {
  const finalHtml = html || text.replace(/\n/g, "<br>");
  const method = getEmailMethod();

  if (method === "resend") {
    return sendViaResend(to, subject, text, finalHtml);
  }
  if (method === "smtp") {
    return sendViaSmtp(to, subject, text, finalHtml);
  }

  return { sent: false, error: "No email method configured. Set RESEND_API_KEY in .env (easiest, no 2FA). Get a free key at resend.com" };
}

// ============= BEAUTIFUL EMAIL SHELL =============
function emailShell(opts: {
  icon: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  accentColor?: string;
}): string {
  const accent = opts.accentColor || "#10b981";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#050807;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="background:#050807;background-image:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(16,185,129,0.08),transparent),radial-gradient(ellipse 60% 40% at 100% 20%,rgba(245,158,11,0.06),transparent),radial-gradient(ellipse 50% 50% at 0% 100%,rgba(16,185,129,0.05),transparent);min-height:100vh;padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td align="center" style="padding:0 0 8px;">
                <div style="display:inline-block;width:48px;height:48px;line-height:48px;text-align:center;background:linear-gradient(135deg,#10b981,#f59e0b);border-radius:12px;font-size:24px;font-weight:900;color:#000;letter-spacing:-1px;">Z</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0;">
                <span style="font-size:18px;font-weight:700;color:#e0e0e0;letter-spacing:0.5px;">Zev</span>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,rgba(20,30,26,0.95),rgba(12,18,16,0.95));border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px -20px rgba(0,0,0,0.5),0 0 40px -10px ${accent}33;">
            <tr>
              <td style="padding:0;">
                <div style="height:4px;background:linear-gradient(90deg,${accent},#f59e0b);"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 0;text-align:center;">
                <div style="display:inline-block;width:56px;height:56px;line-height:56px;text-align:center;font-size:28px;background:linear-gradient(135deg,${accent}22,${accent}11);border:1px solid ${accent}44;border-radius:16px;box-shadow:0 0 20px ${accent}33;">${opts.icon}</div>
                <h1 style="margin:16px 0 6px;font-size:24px;font-weight:800;color:#f0f0f0;letter-spacing:-0.3px;">${opts.title}</h1>
                <p style="margin:0 0 0;font-size:14px;color:#888;font-weight:500;">${opts.subtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;">
                <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;margin-top:12px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:13px;color:#555;">Need help? Join our Discord support server</p>
                  <a href="https://discord.gg/MAExCtnuu6" style="display:inline-block;padding:8px 18px;background:rgba(88,101,242,0.15);color:#9ba3f7;text-decoration:none;font-size:13px;font-weight:600;border-radius:8px;border:1px solid rgba(88,101,242,0.3);">Discord Support</a>
                  <p style="margin:20px 0 0;font-size:11px;color:#333;">Zev by Arsh Raj Sharma. All rights reserved.</p>
                </div>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <tr>
              <td align="center" style="padding:0;">
                <p style="margin:0;font-size:11px;color:#1a2a25;">If you didn't request this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

// ============= PURCHASE EMAIL =============
export async function sendPurchaseEmail(buyerEmail: string, itemName: string, deliveredContent: string): Promise<{ sent: boolean; error?: string }> {
  const safeContent = deliveredContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = `
    <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:14px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#10b981;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Purchase</p>
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f0f0f0;">${itemName}</h2>
      <p style="margin:0;font-size:13px;color:#888;">Thank you for your purchase! Here is your delivery:</p>
    </div>
    <div style="background:#0a0f0d;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;font-family:'Courier New',monospace;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:#10b981;">${safeContent}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#555;text-align:center;">Your purchase is also saved in your Orders page on Zev.</p>
  `;
  return sendEmail({
    to: buyerEmail,
    subject: `Your Zev Purchase: ${itemName}`,
    text: deliveredContent,
    html: emailShell({ icon: "&#10003;", title: "Payment Verified!", subtitle: "Your purchase has been delivered", bodyHtml, accentColor: "#10b981" }),
  });
}

// ============= WELCOME EMAIL =============
export async function sendWelcomeEmail(email: string, name: string, isAdmin: boolean): Promise<{ sent: boolean; error?: string }> {
  const bodyHtml = `
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#f0f0f0;">Welcome, ${name}!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.6;">Your Zev account has been created successfully. You're all set to explore premium Discord tools and bots.</p>
    ${isAdmin ? '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px;margin:0 0 16px;"><p style="margin:0;font-size:13px;color:#f59e0b;font-weight:600;">Admin access granted - you can manage products, stock, and orders from the dashboard.</p></div>' : ''}
    <p style="margin:0 0 10px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">With your account you can:</p>
    <ul style="margin:0;padding-left:18px;color:#ccc;font-size:14px;line-height:2;">
      <li>Browse and purchase premium Discord tools &amp; bots</li>
      <li>Access your purchase history anytime</li>
      <li>Re-download your products whenever needed</li>
    </ul>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;margin-top:16px;">
      <p style="margin:0;font-size:13px;color:#666;">Your login email:</p>
      <p style="margin:4px 0 0;font-size:14px;color:#10b981;font-weight:600;">${email}</p>
    </div>
  `;
  return sendEmail({
    to: email,
    subject: `Welcome to Zev${isAdmin ? " - Admin Access Granted" : ""}!`,
    text: `Welcome to Zev, ${name}!\n\nYour account has been created. Login email: ${email}`,
    html: emailShell({ icon: "&#127881;", title: "Welcome to Zev!", subtitle: "Your account is ready to go", bodyHtml, accentColor: "#10b981" }),
  });
}

// ============= LOGIN NOTIFICATION EMAIL =============
export async function sendLoginEmail(email: string, name: string): Promise<{ sent: boolean; error?: string }> {
  const now = new Date().toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  const bodyHtml = `
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#f0f0f0;">Hi ${name},</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.6;">You just signed in to your Zev account. If this was you, no action is needed.</p>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;">
      <p style="margin:0;font-size:13px;color:#666;">Sign-in time:</p>
      <p style="margin:4px 0 0;font-size:14px;color:#10b981;font-weight:600;">${now} UTC</p>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#f59e0b;">If this wasn't you, please contact us on Discord immediately.</p>
  `;
  return sendEmail({
    to: email,
    subject: `Sign-in Alert - Zev`,
    text: `Hi ${name},\n\nYou just signed in to Zev at ${now} UTC.\n\nIf this wasn't you, contact us on Discord: https://discord.gg/MAExCtnuu6`,
    html: emailShell({ icon: "&#128274;", title: "Sign-in Alert", subtitle: "New sign-in to your account", bodyHtml, accentColor: "#f59e0b" }),
  });
}

// ============= EMAIL VERIFICATION CODE EMAIL =============
export async function sendVerificationEmail(email: string, code: string): Promise<{ sent: boolean; error?: string }> {
  const spacedCode = code.split("").join(" ");
  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:14px;color:#aaa;line-height:1.6;text-align:center;">Enter this code on the website to verify your email and create your account.</p>
    <div style="text-align:center;margin:0 0 20px;">
      <div style="display:inline-block;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(245,158,11,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;padding:24px 40px;box-shadow:0 0 30px rgba(16,185,129,0.2);">
        <p style="margin:0 0 8px;font-size:11px;color:#10b981;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Verification Code</p>
        <p style="margin:0;font-size:36px;font-weight:900;color:#f0f0f0;letter-spacing:8px;font-family:'Courier New',monospace;">${spacedCode}</p>
      </div>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#555;text-align:center;">This code expires in <strong style="color:#f59e0b;">10 minutes</strong></p>
    <p style="margin:0;font-size:12px;color:#333;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
  `;
  return sendEmail({
    to: email,
    subject: `Your Zev Verification Code: ${code}`,
    text: `Your Zev verification code is: ${code}\n\nEnter this code on the website to verify your email. This code expires in 10 minutes.`,
    html: emailShell({ icon: "&#128273;", title: "Verify Your Email", subtitle: "Enter this code to complete signup", bodyHtml, accentColor: "#10b981" }),
  });
}

// Email service for Zev — sends purchase confirmations to buyers.
// Uses nodemailer with SMTP. Configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env
// For Gmail: use an App Password (https://myaccount.google.com/apppasswords)

import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;
let smtpConfigured = false;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  smtpConfigured = true;
  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<{ sent: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    return { sent: false, error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env" };
  }
  try {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@zev.dev";
    const fromName = process.env.SMTP_FROM_NAME || "Zev";
    await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
}

// Send purchase delivery email
export async function sendPurchaseEmail(
  buyerEmail: string,
  itemName: string,
  deliveredContent: string
): Promise<{ sent: boolean; error?: string }> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f0d; color: #e0e0e0; border-radius: 16px; overflow: hidden; border: 1px solid #1a2a25;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #f59e0b 100%); padding: 24px; text-align: center;">
        <h1 style="color: #000; margin: 0; font-size: 28px;">✅ Payment Verified!</h1>
        <p style="color: #000; margin: 8px 0 0; font-weight: 600;">Your purchase has been delivered</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #10b981; margin: 0 0 16px;">${itemName}</h2>
        <p style="color: #aaa; margin: 0 0 24px;">Thank you for your purchase from Zev! Here is your delivery:</p>
        <div style="background: #111815; border: 1px solid #1a2a25; border-radius: 12px; padding: 20px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #10b981;">${deliveredContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1a2a25;">
          <p style="color: #666; font-size: 13px; margin: 0;">Need help? Join our Discord support server:</p>
          <p style="margin: 8px 0 0;"><a href="https://discord.gg/MAExCtnuu6" style="color: #5865F2; text-decoration: none; font-weight: 600;">discord.gg/MAExCtnuu6</a></p>
        </div>
      </div>
      <div style="background: #0d1411; padding: 16px 24px; text-align: center;">
        <p style="color: #444; font-size: 12px; margin: 0;">© Zev by Arsh Raj Sharma. All rights reserved.</p>
      </div>
    </div>
  `;
  return sendEmail({
    to: buyerEmail,
    subject: `✅ Your Zev Purchase: ${itemName}`,
    text: deliveredContent,
    html,
  });
}

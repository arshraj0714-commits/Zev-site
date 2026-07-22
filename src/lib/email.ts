// Email service for Zev — sends emails for signup, login, and purchases.
// Uses nodemailer with SMTP. Configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env

import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

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
    return { sent: false, error: "SMTP not configured" };
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

function emailShell(title: string, subtitle: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f0d; color: #e0e0e0; border-radius: 16px; overflow: hidden; border: 1px solid #1a2a25;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #f59e0b 100%); padding: 24px; text-align: center;">
        <h1 style="color: #000; margin: 0; font-size: 24px;">${title}</h1>
        <p style="color: #000; margin: 8px 0 0; font-weight: 600;">${subtitle}</p>
      </div>
      <div style="padding: 28px 24px;">
        ${bodyHtml}
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #1a2a25;">
          <p style="color: #666; font-size: 13px; margin: 0;">Need help? Join our Discord support server:</p>
          <p style="margin: 8px 0 0;"><a href="https://discord.gg/MAExCtnuu6" style="color: #5865F2; text-decoration: none; font-weight: 600;">discord.gg/MAExCtnuu6</a></p>
        </div>
      </div>
      <div style="background: #0d1411; padding: 14px 24px; text-align: center;">
        <p style="color: #444; font-size: 12px; margin: 0;">© Zev by Arsh Raj Sharma. All rights reserved.</p>
      </div>
    </div>
  `;
}

// Send purchase delivery email
export async function sendPurchaseEmail(
  buyerEmail: string,
  itemName: string,
  deliveredContent: string
): Promise<{ sent: boolean; error?: string }> {
  const safeContent = deliveredContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = `
    <h2 style="color: #10b981; margin: 0 0 16px;">${itemName}</h2>
    <p style="color: #aaa; margin: 0 0 20px;">Thank you for your purchase from Zev! Here is your delivery:</p>
    <div style="background: #111815; border: 1px solid #1a2a25; border-radius: 12px; padding: 18px; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #10b981;">${safeContent}</div>
    <p style="color: #888; font-size: 12px; margin: 16px 0 0;">You can also view this anytime in your Orders page on Zev.</p>
  `;
  return sendEmail({
    to: buyerEmail,
    subject: `✅ Your Zev Purchase: ${itemName}`,
    text: deliveredContent,
    html: emailShell("✅ Payment Verified!", "Your purchase has been delivered", bodyHtml),
  });
}

// Send welcome email on signup
export async function sendWelcomeEmail(
  email: string,
  name: string,
  isAdmin: boolean
): Promise<{ sent: boolean; error?: string }> {
  const bodyHtml = `
    <h2 style="color: #10b981; margin: 0 0 16px;">Welcome, ${name}! 👋</h2>
    <p style="color: #aaa; margin: 0 0 16px;">Your Zev account has been created successfully.</p>
    ${isAdmin ? '<p style="color: #f59e0b; font-weight: 600; margin: 0 0 16px;">You have been granted Admin access. You can manage products, stock, and orders from the dashboard.</p>' : ''}
    <p style="color: #aaa; margin: 0 0 12px;">With your account you can:</p>
    <ul style="color: #ccc; margin: 0 0 16px; padding-left: 20px; line-height: 1.8;">
      <li>Browse and purchase premium Discord tools & bots</li>
      <li>Access your purchase history anytime</li>
      <li>Re-download your products whenever you need them</li>
    </ul>
    <p style="color: #888; font-size: 13px; margin: 0;">Your login email: <strong>${email}</strong></p>
  `;
  return sendEmail({
    to: email,
    subject: `Welcome to Zev${isAdmin ? " — Admin Access Granted" : ""}!`,
    text: `Welcome to Zev, ${name}!\n\nYour account has been created. Your login email: ${email}\n\nThank you for joining Zev.`,
    html: emailShell("Welcome to Zev 🎉", "Your account is ready", bodyHtml),
  });
}

// Send login notification email
export async function sendLoginEmail(
  email: string,
  name: string
): Promise<{ sent: boolean; error?: string }> {
  const now = new Date().toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  const bodyHtml = `
    <h2 style="color: #10b981; margin: 0 0 16px;">Hi ${name},</h2>
    <p style="color: #aaa; margin: 0 0 16px;">You just signed in to your Zev account.</p>
    <p style="color: #888; font-size: 13px; margin: 0;">Sign-in time: <strong>${now} UTC</strong></p>
    <p style="color: #888; font-size: 13px; margin: 8px 0 0;">If this wasn't you, please contact us immediately on Discord.</p>
  `;
  return sendEmail({
    to: email,
    subject: `Sign-in alert — Zev`,
    text: `Hi ${name},\n\nYou just signed in to Zev at ${now} UTC.\n\nIf this wasn't you, contact us on Discord: https://discord.gg/MAExCtnuu6`,
    html: emailShell("🔐 Sign-in Alert", "New sign-in to your account", bodyHtml),
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/seed — populate sample data (idempotent-ish: clears existing first)
export async function POST() {
  try {
    await db.order.deleteMany();
    await db.product.deleteMany();
    await db.stockItem.deleteMany();
    await db.openSource.deleteMany();
    await db.siteStats.deleteMany();

    await db.siteStats.create({
      data: { id: "singleton", vouches: 1000, productsSold: 1573 },
    });

    // Products (paid + free tools/bots)
    await db.product.createMany({
      data: [
        {
          name: "Zephyr Nitro Sniper",
          description: "Ultra-fast Discord Nitro sniper with multi-token support, custom delay, and webhook notifications. Best in class detection engine.",
          image: "/img/zephyr.png",
          codeLink: "https://github.com/zev-dev/zephyr-sniper",
          folder: "Discord Bots",
          type: "paid",
          price: 25,
          tags: "discord,nitro,sniper,bot",
          featured: true,
          salesCount: 342,
        },
        {
          name: "Aether Giveaway Bot",
          description: "Full-featured Discord giveaway bot with anti-cheat, role requirements, and beautiful embeds. Easy to host yourself.",
          image: "/img/aether.png",
          codeLink: "https://github.com/zev-dev/aether-giveaway",
          folder: "Discord Bots",
          type: "paid",
          price: 15,
          tags: "discord,giveaway,bot",
          featured: true,
          salesCount: 218,
        },
        {
          name: "Pulse Mass DM Tool",
          description: "Send mass DMs safely with rate limiting, rotating tokens, and template support. Includes analytics dashboard.",
          image: "/img/pulse.png",
          codeLink: "https://github.com/zev-dev/pulse-dm",
          folder: "Tools",
          type: "paid",
          price: 30,
          tags: "discord,dm,tool,mass",
          salesCount: 156,
        },
        {
          name: "Lumen Token Checker",
          description: "Validate Discord tokens in bulk. Checks email verified, phone verified, nitro status, and more. Lightning fast.",
          image: null,
          codeLink: "https://github.com/zev-dev/lumen-checker",
          folder: "Tools",
          type: "free",
          price: 0,
          tags: "discord,token,checker,free",
          salesCount: 89,
        },
        {
          name: "Serenity Auto-Responder",
          description: "Intelligent Discord auto-responder with keyword triggers, AI replies, and cooldown management.",
          image: null,
          codeLink: "https://github.com/zev-dev/serenity-responder",
          folder: "Discord Bots",
          type: "free",
          price: 0,
          tags: "discord,auto,bot,free",
          salesCount: 64,
        },
        {
          name: "Nova Server Nuker",
          description: "Administrative Discord server management tool for server owners. Full control panel with safety confirmations.",
          image: null,
          codeLink: "https://github.com/zev-dev/nova-nuker",
          folder: "Tools",
          type: "paid",
          price: 20,
          tags: "discord,admin,tool",
          salesCount: 97,
        },
      ],
    });

    // Stock / credentials
    await db.stockItem.createMany({
      data: [
        {
          name: "Premium Email Accounts (5 Pack)",
          description: "5 verified email accounts with full access. Recovery info included. Aged 30+ days.",
          image: "/img/stock-creds.png",
          category: "Email",
          price: 8,
          quantity: 50,
          credentials: JSON.stringify([
            { label: "Email 1", value: "user1@example.com : Pass123!" },
            { label: "Email 2", value: "user2@example.com : Pass456!" },
            { label: "Email 3", value: "user3@example.com : Pass789!" },
            { label: "Email 4", value: "user4@example.com : PassAbc!" },
            { label: "Email 5", value: "user5@example.com : PassXyz!" },
            { label: "Recovery Note", value: "All accounts have recovery email set to recover@zev.dev" },
          ]),
          tags: "email,accounts,verified",
        },
        {
          name: "Discord Token - Full Access (Nitro)",
          description: "1 Discord account with Nitro active. Email & phone verified. Instant delivery.",
          image: "/img/stock-creds.png",
          category: "Account",
          price: 12,
          quantity: 20,
          credentials: JSON.stringify([
            { label: "Token", value: "ODAxMjM0NTY3ODkw.YfGhIj.kxJ9_sample_token_here_abc123" },
            { label: "Email", value: "discord.acc@protonmail.com : DiscordPass2024!" },
            { label: "Note", value: "Enable 2FA after login for security." },
          ]),
          tags: "discord,token,nitro,account",
        },
        {
          name: "VPN Premium Account (1 Year)",
          description: "1-year premium VPN subscription account. Works on all platforms. Uptime guaranteed.",
          image: null,
          category: "Account",
          price: 10,
          quantity: 30,
          credentials: JSON.stringify([
            { label: "Email", value: "vpn.user@zev.dev : VpnSecure2024!" },
            { label: "Subscription", value: "Valid for 365 days from purchase" },
          ]),
          tags: "vpn,account,premium",
        },
        {
          name: "Streaming Service Combo (10 Accounts)",
          description: "10 mixed streaming service accounts. Random premium services. Great value bundle.",
          image: null,
          category: "Account",
          price: 15,
          quantity: 15,
          credentials: JSON.stringify([
            { label: "Account 1", value: "stream1@zev.dev : Stream1Pass!" },
            { label: "Account 2", value: "stream2@zev.dev : Stream2Pass!" },
            { label: "Account 3", value: "stream3@zev.dev : Stream3Pass!" },
            { label: "Note", value: "7 more accounts included in delivery." },
          ]),
          tags: "streaming,accounts,bundle",
        },
      ],
    });

    // Open source free codes
    await db.openSource.createMany({
      data: [
        {
          name: "Discord.js Bot Template",
          description: "Clean, well-structured Discord.js v14 bot template with command handler, events, and slash commands. MIT licensed.",
          image: null,
          codeLink: "https://github.com/zev-dev/djs-template",
          category: "Discord Bot",
          tags: "discord.js,template,bot,free",
          stars: 342,
        },
        {
          name: "Message Scraper Tool",
          description: "Scrape and archive Discord messages to JSON. Useful for backups and analytics. Command line tool.",
          image: null,
          codeLink: "https://github.com/zev-dev/msg-scraper",
          category: "Tool",
          tags: "discord,scraper,tool,free",
          stars: 128,
        },
        {
          name: "Webhook Spammer (Educational)",
          description: "Educational tool demonstrating webhook rate limits. For security testing only. Use responsibly.",
          image: null,
          codeLink: "https://github.com/zev-dev/webhook-test",
          category: "Tool",
          tags: "discord,webhook,tool,free",
          stars: 89,
        },
        {
          name: "Reaction Role Bot",
          description: "Self-hostable reaction role bot with dropdown support. SQLite database, easy setup.",
          image: null,
          codeLink: "https://github.com/zev-dev/reaction-roles",
          category: "Discord Bot",
          tags: "discord,reaction,roles,bot,free",
          stars: 215,
        },
        {
          name: "Server Backup Utility",
          description: "Backup and restore Discord server structure, channels, and roles. CLI + web interface.",
          image: null,
          codeLink: "https://github.com/zev-dev/server-backup",
          category: "Tool",
          tags: "discord,backup,tool,free",
          stars: 176,
        },
      ],
    });

    const counts = {
      products: await db.product.count(),
      stock: await db.stockItem.count(),
      opensource: await db.openSource.count(),
      stats: await db.siteStats.findUnique({ where: { id: "singleton" } }),
    };

    return NextResponse.json({ success: true, seeded: counts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

"use client";

import { Heart, MessageCircle, Shield } from "lucide-react";
import { useZev } from "@/lib/store";
import { SITE_CONFIG } from "@/lib/config";
import { ZevLogo } from "./logo";

export function Footer() {
  const { go } = useZev();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/40 glass-strong">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <ZevLogo className="h-8 w-8" />
              <div>
                <div className="text-lg font-bold text-gradient-mixed">Zev</div>
                <div className="text-xs text-muted-foreground">by {SITE_CONFIG.owner.shortName}</div>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Premium Discord tools, bots, and a trusted digital marketplace. Built and maintained
              by {SITE_CONFIG.owner.name}, {SITE_CONFIG.owner.org}.
            </p>
            <a
              href={SITE_CONFIG.owner.discordSupportServer}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#5865F2]/15 px-3 py-2 text-sm font-medium text-[#9ba3f7] ring-1 ring-[#5865F2]/30 transition-colors hover:bg-[#5865F2]/25"
            >
              <MessageCircle className="h-4 w-4" />
              Join Discord Support Server
            </a>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Explore</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                { id: "products" as const, label: "Marketplace" },
                { id: "opensource" as const, label: "Open Source Codes" },
                { id: "stock" as const, label: "Stock & Accounts" },
                { id: "upload" as const, label: "Upload Tool" },
                { id: "about" as const, label: "About Arsh" },
              ].map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => go(l.id)}
                    className="text-muted-foreground transition-colors hover:text-gold"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">We Accept</h4>
            <div className="mt-4 flex flex-wrap gap-2">
              {["LTC", "BTC", "SOL", "USDT"].map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-accent/40 px-2.5 py-1 text-xs font-semibold text-accent-foreground ring-1 ring-border/50"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-emerald-glow" />
              On-chain verified payments
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-muted-foreground">
            © {year} {SITE_CONFIG.name} by {SITE_CONFIG.owner.name}. {SITE_CONFIG.rights}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Crafted with <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> for the Discord community
          </p>
        </div>
      </div>
    </footer>
  );
}

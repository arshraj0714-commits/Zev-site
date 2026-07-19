"use client";

import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, ShieldCheck, Zap, Coins, Github,
  TrendingUp, Users, Package, CheckCircle2, Wallet, Link2,
} from "lucide-react";
import { useZev } from "@/lib/store";
import { useProducts, useStats, usePrices } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/site/section-heading";
import { MarketplaceCard, type CardItem } from "@/components/site/marketplace-card";
import { SITE_CONFIG } from "@/lib/config";
import { useEffect, useRef, useState } from "react";

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1600;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.floor(eased * value));
            if (p < 1) requestAnimationFrame(tick);
            else setDisplay(value);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}{suffix}
    </span>
  );
}

export function HomeView() {
  const { go } = useZev();
  const { data: productsData } = useProducts("all");
  const { data: statsData } = useStats();
  const { data: pricesData } = usePrices();

  const featured = (productsData?.products ?? [])
    .filter((p) => p.featured)
    .slice(0, 3);
  const fallback = (productsData?.products ?? []).slice(0, 3);
  const showcase = (featured.length ? featured : fallback).map((p): CardItem => ({
    id: p.id, name: p.name, description: p.description, image: p.image,
    price: p.price, type: p.type, folder: p.folder, tags: p.tags,
    codeLink: p.codeLink, salesCount: p.salesCount, kind: "product",
  }));

  const vouches = statsData?.stats.vouches ?? SITE_CONFIG.stats.vouches;
  const sold = statsData?.stats.productsSold ?? SITE_CONFIG.stats.productsSold;

  return (
    <div className="space-y-24 pb-12">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-16 sm:pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm ring-1 ring-emerald-glow/30"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-muted-foreground">Trusted by <span className="font-semibold text-foreground">{vouches.toLocaleString()}+ vouches</span></span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
            >
              <span className="text-gradient-mixed">Premium Discord</span>
              <br />
              <span className="text-foreground">Tools & Bots</span>
              <br />
              <span className="text-gradient-gold">by Arsh</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            >
              Zev delivers battle-tested Discord bots, automation tools, and a verified
              digital marketplace. Pay with crypto — instant on-chain delivery.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Button
                onClick={() => go("products")}
                size="lg"
                className="group gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-xl shadow-emerald-500/25"
              >
                Explore Marketplace
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                onClick={() => go("opensource")}
                size="lg"
                variant="outline"
                className="gap-2 glass"
              >
                <Github className="h-4 w-4" />
                Free Open Source
              </Button>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4"
            >
              {[
                { icon: Users, label: "Vouches", value: vouches, suffix: "+", color: "text-emerald-glow" },
                { icon: Package, label: "Products Sold", value: sold, suffix: "", color: "text-gold" },
                { icon: TrendingUp, label: "Live Crypto Rates", value: 4, suffix: "", color: "text-emerald-glow" },
                { icon: ShieldCheck, label: "On-chain Verified", value: 100, suffix: "%", color: "text-gold" },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl glass p-4 text-center ring-1 ring-border/40">
                  <s.icon className={`mx-auto h-5 w-5 ${s.color}`} />
                  <div className="mt-2 text-2xl font-bold text-foreground">
                    <AnimatedCounter value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== FEATURED ===== */}
      {showcase.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Featured"
            title="Top Tools & Bots"
            subtitle="Hand-picked premium tools loved by the community."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.map((item, i) => (
              <MarketplaceCard key={item.id} item={item} index={i} />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button onClick={() => go("products")} variant="ghost" className="gap-2">
              View all products <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* ===== HOW IT WORKS ===== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="Buy in 3 Simple Steps"
          subtitle="Crypto payments verified directly on the blockchain. No middlemen."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: Wallet, title: "1. Choose & Pay", desc: "Pick a tool or stock item, select your crypto (LTC/BTC/SOL/USDT), and send payment to the displayed address.", color: "from-emerald-500/20" },
            { icon: Link2, title: "2. Submit Tx Hash", desc: "Paste your transaction hash. Our system verifies it on-chain — checking the address and exact amount.", color: "from-gold/20" },
            { icon: CheckCircle2, title: "3. Instant Delivery", desc: "Once verified, your code link or credentials are delivered instantly. All on-chain, all transparent.", color: "from-emerald-500/20" },
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative rounded-2xl glass p-6 ring-1 ring-border/40 halo"
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${step.color} to-transparent opacity-50`} />
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/40 ring-1 ring-border/50">
                  <step.icon className="h-6 w-6 text-gold" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== PAYMENT METHODS ===== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Payments"
          title="Accepted Cryptocurrencies"
          subtitle="Live rates fetched from CoinGecko. Payments verified on their native explorers."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(pricesData?.methods ?? []).map((m, i) => {
            const price = pricesData?.prices?.[m.id] ?? 0;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl glass p-5 ring-1 ring-border/40 halo"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold" style={{ color: m.color }}>{m.symbol}</span>
                  <Coins className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{m.name}</div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  ${price > 0 ? price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 4 : 2 }) : "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{m.chain}</div>
                <a
                  href={m.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-glow hover:underline"
                >
                  Verify on {m.explorer.replace("https://", "")}
                </a>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ===== TRUST BANNER ===== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl glass-strong p-8 ring-1 ring-border/40 sm:p-12"
        >
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-glow/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-gold/20 ring-1 ring-border/50 animate-pulse-glow">
              <Zap className="h-8 w-8 text-gold" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold sm:text-3xl">
                <span className="text-gradient-mixed">Why choose Zev?</span>
              </h3>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Every transaction is verified on the public blockchain. No fake confirmations,
                no scams. Built by {SITE_CONFIG.owner.name} — <span className="text-gold font-medium">{SITE_CONFIG.owner.org}</span> — with {vouches.toLocaleString()}+ community vouches.
              </p>
            </div>
            <Button
              onClick={() => go("about")}
              size="lg"
              className="gap-2 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold"
            >
              <Sparkles className="h-4 w-4" /> Meet Arsh
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

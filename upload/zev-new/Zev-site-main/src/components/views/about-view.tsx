"use client";

import { motion } from "framer-motion";
import {
  MessageCircle, Users, Package, Award, Code2, Zap, Shield,
  ExternalLink, Github, Sparkles, Crown,
} from "lucide-react";
import { SITE_CONFIG } from "@/lib/config";
import { useStats } from "@/hooks/use-data";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AboutView() {
  const { data: statsData } = useStats();
  const vouches = statsData?.stats.vouches ?? SITE_CONFIG.stats.vouches;
  const sold = statsData?.stats.productsSold ?? SITE_CONFIG.stats.productsSold;

  const skills = [
    "Discord.js", "Node.js", "TypeScript", "Python", "Bot Development",
    "API Integration", "Blockchain", "Automation", "Web Scraping", "Security",
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="About the Dev"
        title="Meet Arsh"
        subtitle="The mind behind Zev — a solo developer crafting premium Discord tools."
      />

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-10 overflow-hidden rounded-3xl glass-strong ring-1 ring-border/40"
      >
        <div className="relative h-32 bg-gradient-to-r from-emerald-500/20 via-gold/20 to-emerald-500/20">
          <div className="absolute inset-0 grid-bg opacity-40" />
        </div>
        <div className="px-6 pb-8 sm:px-10">
          <div className="-mt-16 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-gold text-5xl font-extrabold text-black shadow-2xl ring-4 ring-background">
                A
              </div>
              <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-background">
                <Crown className="h-4 w-4 text-black" />
              </div>
            </div>
            <div className="flex-1 pb-1">
              <h2 className="text-3xl font-bold">{SITE_CONFIG.owner.name}</h2>
              <p className="text-gold font-medium">{SITE_CONFIG.owner.role}</p>
              <p className="mt-1 text-sm text-muted-foreground">{SITE_CONFIG.owner.org}</p>
            </div>
            <a href={SITE_CONFIG.owner.discordSupportServer} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4]">
                <MessageCircle className="h-4 w-4" /> Discord
              </Button>
            </a>
          </div>

          {/* Bio */}
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Hey, I&apos;m <span className="font-semibold text-foreground">Arsh Raj Sharma</span> — known online
            as <span className="font-semibold text-gold">escapingdum</span>. I build premium Discord bots,
            automation tools, and a trusted digital marketplace under my org{" "}
            <span className="font-semibold text-emerald-glow">{SITE_CONFIG.owner.org}</span>. Every product
            is battle-tested, every payment is verified on-chain, and every customer gets real support
            through my Discord server. With over {vouches.toLocaleString()}+ vouches and{" "}
            {sold.toLocaleString()} products sold, Zev is built on trust and craft.
          </p>

          {/* Quick facts */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card className="glass p-5 ring-1 ring-border/40">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/40">
                  <MessageCircle className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Discord</div>
                  <div className="font-semibold">{SITE_CONFIG.owner.discord}</div>
                </div>
              </div>
            </Card>
            <Card className="glass p-5 ring-1 ring-border/40">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/40">
                  <Users className="h-5 w-5 text-emerald-glow" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Support Server</div>
                  <a
                    href={SITE_CONFIG.owner.discordSupportServer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-glow hover:underline"
                  >
                    Join Server <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { icon: Users, label: "Vouches", value: vouches, suffix: "+", color: "text-emerald-glow" },
          { icon: Package, label: "Products Sold", value: sold, suffix: "", color: "text-gold" },
          { icon: Award, label: "Reputation", value: 100, suffix: "%", color: "text-emerald-glow" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl glass p-5 text-center ring-1 ring-border/40"
          >
            <s.icon className={`mx-auto h-6 w-6 ${s.color}`} />
            <div className="mt-2 text-3xl font-bold">{s.value.toLocaleString()}{s.suffix}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* What I do */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-center">What I Do</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Code2, title: "Discord Bots", desc: "Custom bots with commands, automod, giveaways & more.", color: "text-emerald-glow" },
            { icon: Zap, title: "Automation Tools", desc: "Snipers, checkers, mass tools with rate-limit safety.", color: "text-gold" },
            { icon: Shield, title: "Verified Sales", desc: "On-chain crypto payment verification for every order.", color: "text-emerald-glow" },
            { icon: Sparkles, title: "Open Source", desc: "Free, MIT-licensed tools for the community to learn from.", color: "text-gold" },
          ].map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl glass p-5 ring-1 ring-border/40 halo"
            >
              <c.icon className={`h-7 w-7 ${c.color}`} />
              <h4 className="mt-3 font-bold">{c.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-center">Tech Stack</h3>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {skills.map((s, i) => (
            <motion.span
              key={s}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="rounded-full bg-accent/30 px-4 py-1.5 text-sm font-medium ring-1 ring-border/40 hover:ring-gold/40 transition-colors"
            >
              {s}
            </motion.span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-12 flex flex-col items-center gap-4 rounded-3xl glass-strong p-8 text-center ring-1 ring-border/40 sm:p-10"
      >
        <Github className="h-10 w-10 text-emerald-glow" />
        <h3 className="text-2xl font-bold">Let&apos;s build something</h3>
        <p className="max-w-md text-muted-foreground">
          Need a custom Discord bot or tool? Join my support server and let&apos;s talk.
          Fast turnaround, fair crypto pricing.
        </p>
        <a href={SITE_CONFIG.owner.discordSupportServer} target="_blank" rel="noopener noreferrer">
          <Button size="lg" className="gap-2 bg-[#5865F2] text-white hover:bg-[#4752c4]">
            <MessageCircle className="h-4 w-4" /> Join Discord Server
          </Button>
        </a>
      </motion.div>
    </div>
  );
}

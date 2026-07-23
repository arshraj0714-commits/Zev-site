"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Gift, Ticket, Loader2, CheckCircle2, ArrowLeft, Copy, Check, Sparkles,
} from "lucide-react";
import { useZev } from "@/lib/store";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

async function fetchJson<T>(url: string): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("zev-auth") : null;
  let tokenVal: string | null = null;
  try { tokenVal = JSON.parse(token || "{}").token; } catch {}
  const res = await fetch(url, {
    headers: tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {},
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

export function RedeemView() {
  const { go, admin } = useZev();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; delivered: string; reward: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["redeem-codes"],
    queryFn: () => fetchJson<{ codes: any[] }>("/api/redeem"),
  });
  const activeCodes = (data?.codes ?? []).filter((c: any) => c.active);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { toast.error("Enter a code"); return; }
    if (!admin) { toast.error("Sign in to redeem codes"); go("auth"); return; }

    setLoading(true);
    setResult(null);
    try {
      const token = JSON.parse(localStorage.getItem("zev-auth") || "{}").token;
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Failed to redeem");
      setResult({ success: true, delivered: data.delivered, reward: data.reward });
      toast.success("Code redeemed! 🎁");
      setCode("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Rewards"
        title="Redeem Code"
        subtitle="Enter a code to claim your reward instantly."
      />

      {/* Redeem form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-2xl glass-bubble glass-bubble-hover p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-gold" />
          <h3 className="text-lg font-bold">Enter Your Code</h3>
        </div>

        <form onSubmit={handleRedeem} className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5" /> Redeem Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="glass mt-1 font-mono text-lg tracking-widest uppercase"
              placeholder="ENTER CODE"
              maxLength={30}
            />
          </div>
          <Button type="submit" disabled={loading || !code.trim()} className="w-full gap-2 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold shadow-lg shadow-gold/20">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Redeeming..." : "Redeem Now"}
          </Button>
        </form>

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-glow/30"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-glow" />
              <span className="font-bold text-emerald-glow">Redeemed: {result.reward}</span>
            </div>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-background/60 p-3 text-xs font-mono">
              {result.delivered}
            </pre>
            <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => copyText(result.delivered)}>
              {copied ? <Check className="h-3 w-3 text-emerald-glow" /> : <Copy className="h-3 w-3" />}
              Copy
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Active codes (publicly visible as banners) */}
      {activeCodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 rounded-2xl glass p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-glow" />
            <h3 className="text-lg font-bold">Active Codes</h3>
          </div>
          <div className="space-y-3">
            {activeCodes.map((c: any) => {
              const remaining = c.maxUses - c.usesCount;
              const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-accent/20 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-bold text-gold">{c.code}</code>
                      <Badge variant="outline" className="text-xs">{c.rewardName || c.rewardType}</Badge>
                    </div>
                    {c.description && <p className="mt-0.5 text-xs text-muted-foreground truncate">{c.description}</p>}
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {remaining} use{remaining !== 1 ? "s" : ""} left
                      {c.expiresAt && !expired && ` · expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                      {expired && " · expired"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCode(c.code)}
                    className="shrink-0"
                  >
                    Use
                  </Button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {!admin && (
        <div className="mt-6 rounded-xl bg-accent/20 p-4 text-center text-sm text-muted-foreground">
          You need to <button onClick={() => go("auth")} className="text-emerald-glow underline">sign in</button> to redeem codes.
        </div>
      )}

      <button onClick={() => go("home")} className="mt-8 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </button>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Copy, Check, Wallet, Loader2, ShieldCheck, AlertCircle, RefreshCw,
  CheckCircle2, Sparkles, ArrowRight, Coins, Mail, ExternalLink,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useZev } from "@/lib/store";
import { usePrices } from "@/hooks/use-data";
import { ItemImage } from "@/components/site/item-image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "method" | "pay" | "success";

export function CheckoutModal() {
  const { checkoutOpen, checkoutTarget, closeCheckout } = useZev();
  const { data: pricesData } = usePrices();

  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<string>("LTC");
  const [email, setEmail] = useState("");
  const [discord, setDiscord] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cryptoAmount, setCryptoAmount] = useState(0);
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [delivered, setDelivered] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyTries, setVerifyTries] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const target = checkoutTarget;
  const isFree = target?.price === 0;

  const methods = pricesData?.methods ?? [];
  const prices = pricesData?.prices ?? {};

  useEffect(() => {
    if (checkoutOpen) {
      setStep("method");
      setMethod("LTC");
      setOrderId(null);
      setDelivered(null);
      setVerifyMsg(null);
      setVerifyTries(0);
      setEmailSent(false);
    }
  }, [checkoutOpen, checkoutTarget]);

  // For free items, create order immediately and deliver
  async function handleContinue() {
    if (!target) return;
    if (isFree) {
      await createOrder("LTC"); // method irrelevant for free
      return;
    }
    await createOrder(method);
  }

  async function createOrder(m: string) {
    if (!target) return;
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: target.itemType,
          itemId: target.itemId,
          paymentMethod: m,
          buyerEmail: email || undefined,
          buyerDiscord: discord || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");
      setOrderId(data.order.id);
      setCryptoAmount(data.order.cryptoAmount);
      const methodInfo = methods.find((mm) => mm.id === m);
      setAddress(methodInfo?.address ?? "");
      if (data.order.status === "paid" && data.order.deliveredContent) {
        setDelivered(data.order.deliveredContent);
        setEmailSent(!!data.emailSent);
        setStep("success");
      } else {
        setStep("pay");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // Buyer confirms they sent payment — server scans the blockchain for a match
  async function confirmPayment() {
    if (!orderId) return;
    setConfirming(true);
    setVerifyMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify");
      if (data.verified) {
        setDelivered(data.delivered || "Payment verified on-chain! Your purchase has been delivered.");
        setEmailSent(!!data.emailSent);
        setStep("success");
        toast.success("Payment verified on the blockchain! 🎉");
      } else {
        // Payment not detected yet
        setVerifyMsg(data.message || "No matching payment detected yet.");
        setVerifyTries((t) => t + 1);
        toast.error("Payment not detected yet — see details below.");
      }
    } catch (e) {
      setVerifyMsg(`Verification error: ${(e as Error).message}`);
      toast.error((e as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(null), 2000);
  }

  const selectedMethod = methods.find((m) => m.id === method);

  return (
    <Dialog open={checkoutOpen} onOpenChange={(o) => !o && closeCheckout()}>
      <DialogContent className="max-w-lg overflow-hidden border-border/40 bg-card/95 p-0 backdrop-blur-2xl sm:max-w-xl">
        <DialogHeader className="border-b border-border/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Wallet className="h-5 w-5 text-gold" />
                {isFree ? "Get Free Item" : "Secure Checkout"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isFree ? "No payment needed — instant delivery." : "Pay with crypto, get instant delivery"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {target && (
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Item summary */}
            <div className="flex gap-3 border-b border-border/40 p-5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl glass ring-1 ring-border/40">
                <ItemImage src={target.image} alt={target.name} seed={target.name} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold">{target.name}</h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">{target.description}</p>
                <div className="mt-1 flex items-center gap-2">
                  {isFree ? (
                    <Badge className="bg-emerald-500/90 text-emerald-950">FREE</Badge>
                  ) : (
                    <span className="text-lg font-bold text-gold">${target.price.toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="p-5">
              {/* STEP: method + contact */}
              {step === "method" && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email (for delivery)</Label>
                      <Input value={email} onChange={(e)=>setEmail(e.target.value)} className="glass" placeholder="you@email.com" type="email" />
                    </div>
                    <div>
                      <Label>Discord (optional)</Label>
                      <Input value={discord} onChange={(e)=>setDiscord(e.target.value)} className="glass" placeholder="username" />
                    </div>
                  </div>

                  {!isFree && (
                    <div>
                      <Label className="mb-2 block">Choose Payment Method</Label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {methods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setMethod(m.id)}
                            className={cn(
                              "rounded-xl p-3 text-center ring-1 transition-all",
                              method === m.id
                                ? "bg-accent/40 ring-gold scale-105"
                                : "glass ring-border/40 hover:ring-border"
                            )}
                          >
                            <div className="text-sm font-bold" style={{ color: m.color }}>{m.symbol}</div>
                            <div className="text-[10px] text-muted-foreground">${(prices[m.id] ?? 0).toFixed(prices[m.id] < 1 ? 4 : 2)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isFree && selectedMethod && (
                    <div className="rounded-xl bg-accent/20 p-4 ring-1 ring-border/40">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">You'll pay approximately</span>
                        <span className="font-bold text-gold">
                          {(target.price / (prices[method] || 1)).toFixed(method === "BTC" || method === "LTC" ? 6 : 4)} {method}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>= ${target.price.toFixed(2)} USD</span>
                        <span>Rate: 1 {method} = ${(prices[method] ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleContinue} disabled={creating} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {isFree ? "Get It Free" : "Continue to Payment"}
                  </Button>
                </motion.div>
              )}

              {/* STEP: pay — show address + amount + "I've Paid" button (no tx hash) */}
              {step === "pay" && selectedMethod && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  {/* Address */}
                  <div className="rounded-xl glass p-4 ring-1 ring-emerald-glow/30">
                    <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" /> Send {selectedMethod.symbol} to this address
                    </Label>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 truncate rounded-lg bg-background/60 px-3 py-2 text-sm font-mono text-emerald-glow">
                        {address}
                      </code>
                      <Button size="icon" variant="outline" className="glass shrink-0" onClick={() => copy(address, "Address")}>
                        {copied === "Address" ? <Check className="h-4 w-4 text-emerald-glow" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="rounded-xl bg-gold/10 p-4 ring-1 ring-gold/30">
                    <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      <Coins className="h-3.5 w-3.5" /> Amount to Send
                    </Label>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-2xl font-bold text-gold">
                        {cryptoAmount.toFixed(method === "BTC" || method === "LTC" ? 8 : 6)} {selectedMethod.symbol}
                      </span>
                      <Button size="sm" variant="outline" className="glass gap-1" onClick={() => copy(cryptoAmount.toFixed(8), "Amount")}>
                        {copied === "Amount" ? <Check className="h-3.5 w-3.5 text-emerald-glow" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">≈ ${target.price.toFixed(2)} USD</p>
                  </div>

                  <a href={selectedMethod.explorer} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-emerald-glow hover:underline">
                    Check explorer: {selectedMethod.explorer.replace("https://","")} <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* Instructions */}
                  <div className="rounded-xl bg-accent/15 p-3 text-xs text-muted-foreground ring-1 ring-border/40">
                    <p className="font-medium text-foreground">How to pay</p>
                    <p className="mt-1">1. Copy the <span className="text-emerald-glow font-semibold">address</span> and <span className="text-gold font-semibold">amount</span> above.<br/>2. Send the <span className="text-gold font-semibold">exact amount</span> from your crypto wallet.<br/>3. Once sent, click <span className="text-foreground font-semibold">&quot;I&apos;ve Paid — Verify&quot;</span> below. We scan the blockchain for your payment and deliver instantly once it&apos;s detected.</p>
                  </div>

                  {/* Verification message */}
                  {verifyMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-500/30"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <div className="flex-1">
                        <p className="text-xs text-amber-200">{verifyMsg}</p>
                        {verifyTries > 0 && (
                          <p className="mt-1 text-[10px] text-amber-200/70">Attempt #{verifyTries} · Transactions can take 1–10 minutes to appear on-chain.</p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <Button onClick={confirmPayment} disabled={confirming} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : verifyMsg ? <RefreshCw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {confirming ? "Scanning blockchain..." : verifyMsg ? "Check Again" : "I've Paid — Verify"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    🔒 We verify your payment directly on the blockchain — no manual approval needed.
                  </p>
                  <button onClick={() => setStep("method")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                    ← Change method
                  </button>
                </motion.div>
              )}

              {/* STEP: success */}
              {step === "success" && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                  <div className="flex flex-col items-center text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-glow"
                    >
                      <CheckCircle2 className="h-9 w-9 text-emerald-glow" />
                    </motion.div>
                    <h3 className="mt-3 text-xl font-bold text-gradient-emerald">{isFree ? "Delivered!" : "Payment Verified!"}</h3>
                    <p className="text-sm text-muted-foreground">Confirmed on the blockchain — your purchase is delivered.</p>
                  </div>

                  {delivered && (
                    <div className="rounded-xl glass p-4 ring-1 ring-emerald-glow/30">
                      <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-glow">
                        <Sparkles className="h-3.5 w-3.5" /> Your Purchase
                      </Label>
                      <pre className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-background/60 p-3 text-sm font-mono text-foreground">
                        {delivered}
                      </pre>
                      <Button size="sm" variant="outline" className="mt-2 glass gap-1" onClick={() => copy(delivered, "Content")}>
                        {copied === "Content" ? <Check className="h-3.5 w-3.5 text-emerald-glow" /> : <Copy className="h-3.5 w-3.5" />} Copy content
                      </Button>
                    </div>
                  )}

                  {emailSent && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-glow/20">
                      <Mail className="h-4 w-4 shrink-0 text-emerald-glow" />
                      <p className="text-xs text-emerald-200">A copy of your purchase has been sent to your email.</p>
                    </div>
                  )}

                  <Button onClick={closeCheckout} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
                    Done
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

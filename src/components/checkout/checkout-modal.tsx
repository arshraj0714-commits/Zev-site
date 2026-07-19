"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Copy, Check, Wallet, Loader2, ShieldCheck, AlertCircle,
  CheckCircle2, Sparkles, ArrowRight, Coins, Mail, ExternalLink, Radio,
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
  const [delivered, setDelivered] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  // Auto-polling state
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [foundTx, setFoundTx] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const target = checkoutTarget;
  const isFree = target?.price === 0;

  const methods = pricesData?.methods ?? [];
  const prices = pricesData?.prices ?? {};

  // Cleanup polling on unmount / modal close
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    setPolling(false);
  }, []);

  useEffect(() => {
    if (checkoutOpen) {
      setStep("method");
      setMethod("LTC");
      setOrderId(null);
      setDelivered(null);
      setVerifyMsg(null);
      setPollCount(0);
      setFoundTx(false);
      setEmailSent(false);
    } else {
      stopPolling();
    }
  }, [checkoutOpen, checkoutTarget, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleContinue() {
    if (!target) return;
    if (isFree) {
      await createOrder("LTC");
      return;
    }
    await createOrder(method);
  }

  async function createOrder(m: string) {
    if (!target) return;
    setCreating(true);
    setVerifyMsg(null);
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
        setVerifyMsg("Waiting for your payment... Send the exact amount to the address above. We're checking automatically.");
        // Start auto-polling
        setTimeout(() => startPolling(data.order.id), 2000);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // Auto-polling: check the blockchain every 8 seconds
  const startPolling = useCallback((id: string) => {
    if (pollTimer.current) return; // already polling
    setPolling(true);

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${id}/check`);
        const data = await res.json();
        setPollCount((c) => c + 1);

        if (data.verified) {
          // Payment detected! Deliver
          stopPolling();
          setDelivered(data.delivered || "Payment auto-detected! Your purchase has been delivered.");
          setEmailSent(!!data.emailSent);
          setStep("success");
          toast.success("Payment auto-detected! 🎉");
          return;
        }

        if (data.found && !foundTx) {
          setFoundTx(true);
          setVerifyMsg("Transaction detected! Waiting for it to confirm the exact amount...");
          toast.info("Transaction detected — verifying amount...");
        } else if (!data.found) {
          setVerifyMsg(
            pollCountRef.current === 0
              ? "Waiting for your payment... Send the exact amount to the address above. We're checking automatically."
              : `Still waiting... (${pollCountRef.current} checks done). Send exactly ${cryptoAmountRef.current.toFixed(8)} ${methodRef.current} to the address. Transactions usually appear within 1-5 minutes.`
          );
        }
      } catch {
        // network error — keep trying
      }

      // schedule next poll in 8 seconds
      pollTimer.current = setTimeout(poll, 8000);
    };

    poll();
  }, [stopPolling, foundTx]);

  // refs to access latest values inside poll closure
  const pollCountRef = useRef(0);
  const cryptoAmountRef = useRef(0);
  const methodRef = useRef("LTC");
  useEffect(() => { pollCountRef.current = pollCount; }, [pollCount]);
  useEffect(() => { cryptoAmountRef.current = cryptoAmount; }, [cryptoAmount]);
  useEffect(() => { methodRef.current = method; }, [method]);

  // manual "check now" button (in addition to auto-polling)
  async function checkNow() {
    if (!orderId) return;
    setPolling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/check`);
      const data = await res.json();
      setPollCount((c) => c + 1);
      if (data.verified) {
        stopPolling();
        setDelivered(data.delivered || "Payment verified! Your purchase has been delivered.");
        setEmailSent(!!data.emailSent);
        setStep("success");
        toast.success("Payment detected! 🎉");
      } else {
        if (data.found && !foundTx) setFoundTx(true);
        setVerifyMsg(data.message || "No payment detected yet — still checking...");
        toast.info(data.message || "Still waiting for payment...");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPolling(false);
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
                {isFree ? "No payment needed — instant delivery." : "Auto-detection — we watch the blockchain for you"}
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
                    {isFree ? "Get It Free" : "Show Payment Address"}
                  </Button>
                </motion.div>
              )}

              {/* STEP: pay — auto-polling */}
              {step === "pay" && selectedMethod && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  {/* Auto-detection banner */}
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-glow/30">
                    <Radio className="h-4 w-4 shrink-0 animate-pulse text-emerald-glow" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-emerald-glow">Auto-detection is ON</p>
                      <p className="text-[10px] text-muted-foreground">
                        {polling ? `Checking blockchain every 8s · ${pollCount} ${pollCount === 1 ? "check" : "checks"} done` : "Starting auto-check..."}
                      </p>
                    </div>
                    {polling && <Loader2 className="h-4 w-4 animate-spin text-emerald-glow" />}
                  </div>

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
                      <Coins className="h-3.5 w-3.5" /> Exact Amount to Send
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
                    View explorer: {selectedMethod.explorer.replace("https://","")} <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* Instructions */}
                  <div className="rounded-xl bg-accent/15 p-3 text-xs text-muted-foreground ring-1 ring-border/40">
                    <p className="font-medium text-foreground">How it works</p>
                    <p className="mt-1">
                      1. Copy the <span className="text-emerald-glow font-semibold">address</span> and <span className="text-gold font-semibold">amount</span> above.<br/>
                      2. Send the <span className="text-gold font-semibold">exact amount</span> from your crypto wallet.<br/>
                      3. <span className="text-foreground font-semibold">That&apos;s it!</span> We automatically check the blockchain every 8 seconds. The moment your transaction appears (even pending), your product is delivered instantly — no need to click anything.
                    </p>
                  </div>

                  {/* Status message */}
                  {verifyMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex items-start gap-2 rounded-xl p-3 ring-1",
                        foundTx
                          ? "bg-blue-500/10 ring-blue-500/30"
                          : "bg-amber-500/10 ring-amber-500/30"
                      )}
                    >
                      {foundTx ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-400" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      )}
                      <div className="flex-1">
                        <p className={cn("text-xs", foundTx ? "text-blue-200" : "text-amber-200")}>{verifyMsg}</p>
                        {pollCount > 0 && (
                          <p className="mt-1 text-[10px] opacity-70">
                            {foundTx ? "Confirming amount..." : `${pollCount} ${pollCount === 1 ? "check" : "checks"} done · auto-checking every 8s`}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Manual check button (optional) */}
                  <Button onClick={checkNow} disabled={polling} variant="outline" className="w-full gap-2 glass">
                    {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {polling ? "Checking..." : "Check Now"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    🔒 Live blockchain monitoring — your product delivers the instant your payment is detected.
                  </p>
                  <button onClick={() => { stopPolling(); setStep("method"); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
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
                    <h3 className="mt-3 text-xl font-bold text-gradient-emerald">{isFree ? "Delivered!" : "Payment Auto-Detected!"}</h3>
                    <p className="text-sm text-muted-foreground">Your transaction was detected on the blockchain — purchase delivered.</p>
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

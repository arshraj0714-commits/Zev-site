"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Copy, Check, Wallet, Loader2, ShieldCheck, ExternalLink,
  CheckCircle2, AlertCircle, Sparkles, ArrowRight, Coins, Mail, Hash,
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

type Step = "method" | "pay" | "verify" | "success";

interface VerifyResponse {
  verified: boolean;
  alreadyPaid?: boolean;
  order?: any;
  result?: any;
  message?: string;
}

export function CheckoutModal() {
  const { checkoutOpen, checkoutTarget, closeCheckout } = useZev();
  const { data: pricesData } = usePrices();

  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<string>("LTC");
  const [email, setEmail] = useState("");
  const [discord, setDiscord] = useState("");
  const [txHash, setTxHash] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cryptoAmount, setCryptoAmount] = useState(0);
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const target = checkoutTarget;
  const isFree = target?.price === 0;

  const methods = pricesData?.methods ?? [];
  const prices = pricesData?.prices ?? {};

  useEffect(() => {
    if (checkoutOpen) {
      setStep("method");
      setMethod("LTC");
      setTxHash("");
      setOrderId(null);
      setDelivered(null);
      setVerifyMsg(null);
    }
  }, [checkoutOpen, checkoutTarget]);

  // For free items, jump straight to creation
  async function handleContinue() {
    if (!target) return;
    if (isFree) {
      await createOrder("LTC"); // method irrelevant for free
      return;
    }
    setStep("pay");
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
        setStep("success");
      } else {
        setStep("verify");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function verifyPayment() {
    if (!orderId || !txHash.trim()) {
      toast.error("Enter your transaction hash");
      return;
    }
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, txHash: txHash.trim() }),
      });
      const data: VerifyResponse = await res.json();
      if (data.verified) {
        setDelivered(data.order?.deliveredContent ?? "Payment verified! Check your email/Discord for delivery.");
        setStep("success");
        toast.success("Payment verified! 🎉");
      } else {
        setVerifyMsg(data.message || "Payment not verified yet.");
        toast.error("Payment not verified yet — see details below.");
      }
    } catch (e) {
      setVerifyMsg(`Verification error: ${(e as Error).message}`);
    } finally {
      setVerifying(false);
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
                {isFree ? "No payment needed — instant delivery." : "On-chain crypto payment verification"}
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

              {/* STEP: pay (for paid) */}
              {step === "pay" && selectedMethod && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="rounded-xl bg-gradient-to-br from-accent/30 to-transparent p-4 ring-1 ring-gold/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pay with</span>
                      <span className="font-bold" style={{ color: selectedMethod.color }}>{selectedMethod.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{selectedMethod.chain}</div>
                  </div>
                  <Button onClick={() => createOrder(method)} disabled={creating} className="w-full gap-2 bg-gradient-to-r from-gold to-amber-400 text-black">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Generate Payment Address
                  </Button>
                  <button onClick={() => setStep("method")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                    ← Change method
                  </button>
                </motion.div>
              )}

              {/* STEP: verify */}
              {step === "verify" && selectedMethod && (
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
                      <Coins className="h-3.5 w-3.5" /> Exact Amount
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
                    Verify on {selectedMethod.explorer.replace("https://","")} <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* QR-like note */}
                  <div className="rounded-xl bg-accent/15 p-3 text-xs text-muted-foreground ring-1 ring-border/40">
                    <p className="font-medium text-foreground">⚠ Important</p>
                    <p className="mt-1">Send the <span className="text-gold font-semibold">exact amount</span> from any wallet. After sending, paste your transaction hash below. We verify it on-chain — no manual confirmation needed.</p>
                  </div>

                  {/* Tx hash input */}
                  <div>
                    <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Transaction Hash</Label>
                    <Input
                      value={txHash}
                      onChange={(e)=>setTxHash(e.target.value)}
                      className="glass font-mono text-sm"
                      placeholder="Paste your tx hash / signature..."
                    />
                  </div>

                  {verifyMsg && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-500/30">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <p className="text-xs text-amber-200">{verifyMsg}</p>
                    </div>
                  )}

                  <Button onClick={verifyPayment} disabled={verifying || !txHash.trim()} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {verifying ? "Verifying on-chain..." : "Verify Payment"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Verification checks the blockchain for your exact amount to Arsh&apos;s address.
                  </p>
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
                    <h3 className="mt-3 text-xl font-bold text-gradient-emerald">Payment Verified!</h3>
                    <p className="text-sm text-muted-foreground">Your purchase has been delivered.</p>
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

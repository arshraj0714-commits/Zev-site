"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Copy, Check, Loader2, CheckCircle2, Clock, Coins, Mail,
  ExternalLink, ArrowLeft, Zap,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useZev } from "@/lib/store";
import { usePrices } from "@/hooks/use-data";
import { ItemImage } from "@/components/site/item-image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "details" | "pay" | "success";

// Safely parse a fetch response as JSON — never throws, even if the response
// is plain text (like "Not Found" from a 404). Returns {} on parse failure.
async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function CheckoutModal() {
  const { checkoutOpen, checkoutTarget, closeCheckout } = useZev();
  const { data: pricesData } = usePrices();

  const [step, setStep] = useState<Step>("details");
  const [method, setMethod] = useState<string>("LTC");
  const [email, setEmail] = useState("");
  const [discord, setDiscord] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cryptoAmount, setCryptoAmount] = useState(0);
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [delivered, setDelivered] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  // Auto-polling
  const [pollCount, setPollCount] = useState(0);
  const [foundTx, setFoundTx] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderIdRef = useRef<string | null>(null);

  const target = checkoutTarget;
  const isFree = target?.price === 0;
  const methods = pricesData?.methods ?? [];
  const prices = pricesData?.prices ?? {};
  const selectedMethod = methods.find((m) => m.id === method);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (checkoutOpen) {
      setStep("details");
      setMethod("LTC");
      setOrderId(null);
      setDelivered(null);
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
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: target.itemType,
          itemId: target.itemId,
          paymentMethod: method,
          buyerEmail: email || undefined,
          buyerDiscord: discord || undefined,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to create order");
      setOrderId(data.order.id);
      orderIdRef.current = data.order.id;
      setCryptoAmount(data.order.cryptoAmount);
      const methodInfo = methods.find((mm) => mm.id === method);
      setAddress(methodInfo?.address ?? "");
      if (data.order.status === "paid" && data.order.deliveredContent) {
        setDelivered(data.order.deliveredContent);
        setEmailSent(!!data.emailSent);
        setStep("success");
      } else {
        setStep("pay");
        setTimeout(() => startPolling(data.order.id), 2000);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const startPolling = useCallback((id: string) => {
    if (pollTimer.current) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${id}/check`);
        const data = await safeJson(res);
        setPollCount((c) => c + 1);
        if (data.verified) {
          stopPolling();
          setDelivered(data.delivered || "Payment auto-detected!");
          setEmailSent(!!data.emailSent);
          setStep("success");
          toast.success("Payment detected! 🎉");
          return;
        }
        if (data.found) {
          setFoundTx(true);
        }
      } catch { /* keep trying */ }
      pollTimer.current = setTimeout(poll, 8000);
    };
    poll();
  }, [stopPolling]);

  async function checkNow() {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/check`);
      const data = await safeJson(res);
      setPollCount((c) => c + 1);
      if (data.verified) {
        stopPolling();
        setDelivered(data.delivered || "Payment verified!");
        setEmailSent(!!data.emailSent);
        setStep("success");
        toast.success("Payment detected! 🎉");
      } else {
        if (data.found) setFoundTx(true);
        toast.info(data.found ? "Transaction detected — confirming..." : "No payment detected yet");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Dialog open={checkoutOpen} onOpenChange={(o) => !o && closeCheckout()}>
      <DialogContent className="max-w-md overflow-hidden border-border/40 bg-card/95 p-0 backdrop-blur-2xl">
        <DialogHeader className="border-b border-border/40 p-5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-gold">
              <Zap className="h-4 w-4 text-black" />
            </div>
            Zev Checkout
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {step === "success" ? "Complete" : isFree ? "Free delivery" : "Auto-detect payment · instant delivery"}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="max-h-[75vh] overflow-y-auto">
            {/* Item summary — compact */}
            <div className="flex items-center gap-3 border-b border-border/40 p-4">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg glass ring-1 ring-border/40">
                <ItemImage src={target.image} alt={target.name} seed={target.name} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold">{target.name}</h3>
                <div className="mt-0.5 flex items-center gap-2">
                  {isFree ? (
                    <span className="text-xs font-bold text-emerald-glow">FREE</span>
                  ) : (
                    <span className="text-base font-bold text-gold">${target.price.toFixed(2)}</span>
                  )}
                </div>
              </div>
              {selectedMethod && !isFree && step === "pay" && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{selectedMethod.symbol}</div>
                  <div className="text-sm font-bold" style={{ color: selectedMethod.color }}>
                    {cryptoAmount.toFixed(method === "BTC" || method === "LTC" ? 6 : 4)}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5">
              {/* STEP 1: Details + method */}
              {step === "details" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div>
                    <Label className="text-xs"><Mail className="inline h-3 w-3 mr-1" />Email for delivery</Label>
                    <Input value={email} onChange={(e)=>setEmail(e.target.value)} className="glass mt-1" placeholder="you@email.com" type="email" />
                  </div>
                  <div>
                    <Label className="text-xs">Discord (optional)</Label>
                    <Input value={discord} onChange={(e)=>setDiscord(e.target.value)} className="glass mt-1" placeholder="username" />
                  </div>

                  {!isFree && (
                    <div>
                      <Label className="mb-2 block text-xs">Payment Method</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {methods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setMethod(m.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg p-2.5 ring-1 transition-all",
                              method === m.id
                                ? "bg-accent/40 ring-gold"
                                : "glass ring-border/40 hover:ring-border"
                            )}
                          >
                            <span className="text-sm font-bold" style={{ color: m.color }}>{m.symbol}</span>
                            <span className="text-xs text-muted-foreground truncate">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isFree && selectedMethod && (
                    <div className="rounded-lg bg-accent/20 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold text-gold">
                          {(target.price / (prices[method] || 1)).toFixed(method === "BTC" || method === "LTC" ? 6 : 4)} {method}
                        </span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-xs text-muted-foreground">
                        <span>= ${target.price.toFixed(2)} USD</span>
                        <span>1 {method} = ${(prices[method] ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleContinue} disabled={creating} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isFree ? "Get Free" : "Continue to Payment"}
                  </Button>
                </motion.div>
              )}

              {/* STEP 2: Pay — clean, mysellauth-style */}
              {step === "pay" && selectedMethod && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Status indicator */}
                  <div className={cn(
                    "flex items-center gap-2 rounded-lg p-3 text-sm ring-1",
                    foundTx ? "bg-blue-500/10 ring-blue-500/30" : "bg-amber-500/10 ring-amber-500/30"
                  )}>
                    {foundTx ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                    )}
                    <span className={cn("text-xs", foundTx ? "text-blue-200" : "text-amber-200")}>
                      {foundTx ? "Transaction detected — confirming amount..." : "Waiting for payment"}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{pollCount} checks</span>
                  </div>

                  {/* Send to address */}
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Send {selectedMethod.symbol} to</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-lg bg-background/80 px-3 py-2.5 text-xs font-mono text-emerald-glow ring-1 ring-border/40">
                        {address}
                      </code>
                      <Button size="icon" variant="outline" className="shrink-0" onClick={() => copy(address, "Address")}>
                        {copied === "Address" ? <Check className="h-4 w-4 text-emerald-glow" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Exact amount */}
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Exact Amount</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg bg-background/80 px-3 py-2.5 ring-1 ring-gold/30">
                        <span className="font-mono text-base font-bold text-gold">
                          {cryptoAmount.toFixed(method === "BTC" || method === "LTC" ? 8 : 6)}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">{selectedMethod.symbol}</span>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => copy(cryptoAmount.toFixed(8), "Amount")}>
                        {copied === "Amount" ? <Check className="h-3.5 w-3.5 text-emerald-glow" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">≈ ${target.price.toFixed(2)} USD</div>
                  </div>

                  {/* Network */}
                  <div className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-medium">{selectedMethod.chain}</span>
                  </div>

                  <a href={selectedMethod.explorer} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-emerald-glow hover:underline">
                    View on {selectedMethod.explorer.replace("https://","")} <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* Info */}
                  <div className="rounded-lg bg-emerald-500/5 p-3 text-xs text-muted-foreground ring-1 ring-emerald-glow/10">
                    <p className="font-medium text-emerald-glow mb-1">⚡ Auto-detection active</p>
                    <p>Send the exact amount from any wallet. We check the blockchain automatically every 8 seconds — your product delivers the moment your transaction appears (even pending).</p>
                  </div>

                  <Button onClick={checkNow} variant="outline" className="w-full gap-2 text-xs">
                    <Loader2 className="h-3.5 w-3.5" /> Check now ({pollCount})
                  </Button>

                  <button onClick={() => { stopPolling(); setStep("details"); }} className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                </motion.div>
              )}

              {/* STEP 3: Success */}
              {step === "success" && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                  <div className="flex flex-col items-center text-center py-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-glow"
                    >
                      <CheckCircle2 className="h-8 w-8 text-emerald-glow" />
                    </motion.div>
                    <h3 className="mt-3 text-lg font-bold text-gradient-emerald">
                      {isFree ? "Delivered!" : "Payment Detected!"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isFree ? "Your product is ready." : "Auto-verified on the blockchain."}
                    </p>
                  </div>

                  {delivered && (
                    <div className="rounded-lg glass p-3 ring-1 ring-emerald-glow/30">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-emerald-glow">
                        <Coins className="h-3.5 w-3.5" /> Your Purchase
                      </div>
                      <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2.5 text-xs font-mono">
                        {delivered}
                      </pre>
                      <Button size="sm" variant="outline" className="mt-2 gap-1 text-xs" onClick={() => copy(delivered, "Content")}>
                        {copied === "Content" ? <Check className="h-3 w-3 text-emerald-glow" /> : <Copy className="h-3 w-3" />} Copy
                      </Button>
                    </div>
                  )}

                  {emailSent && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-200 ring-1 ring-emerald-glow/20">
                      <Mail className="h-3.5 w-3.5" /> A copy was sent to your email.
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

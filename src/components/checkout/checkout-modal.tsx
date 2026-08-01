"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, Loader2, CheckCircle2, Coins, Mail,
  ExternalLink, ArrowLeft, Zap, Download, FileArchive,
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

// Safely parse a fetch response as JSON — never throws
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
  const { checkoutOpen, checkoutTarget, closeCheckout, checkoutCart, clearCart } = useZev();
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
  const [deliveredFile, setDeliveredFile] = useState<{ name: string; size: number | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  // Cart group ID for cart mode polling
  const [cartGroupId, setCartGroupId] = useState<string | null>(null);
  // Cart deliveries (multiple items)
  const [cartDeliveries, setCartDeliveries] = useState<any[] | null>(null);

  // Auto-polling — with a separate "checking" state so the UI stays responsive
  const [pollCount, setPollCount] = useState(0);
  const [foundTx, setFoundTx] = useState(false);
  const [checking, setChecking] = useState(false); // true WHILE a check fetch is in-flight
  const [pollingStarted, setPollingStarted] = useState(false); // true after user clicks "Buy"
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const isPollingRef = useRef(false);

  // Cart mode: if checkoutCart is set, we're checking out multiple items
  const isCartMode = !!checkoutCart && checkoutCart.length > 0;
  const cartItems = checkoutCart || [];
  const cartTotalUSD = cartItems.reduce((sum, i) => sum + i.price, 0);

  const target = checkoutTarget;
  const isFree = isCartMode ? cartTotalUSD === 0 : target?.price === 0;

  // Check for stored discount from redeemed codes
  const [discountPct, setDiscountPct] = useState(0);
  const [discountCode, setDiscountCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("zev-discount");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.pct > 0) {
          setDiscountPct(parsed.pct);
          setDiscountCode(parsed.code || null);
        }
      }
    } catch {}
  }, [checkoutOpen]);

  // Calculate discounted price
  const originalPrice = isCartMode ? cartTotalUSD : (target?.price || 0);
  const discountedPrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice;
  const effectivePrice = isFree ? 0 : discountedPrice;

  const methods = pricesData?.methods ?? [];
  const prices = pricesData?.prices ?? {};
  const selectedMethod = methods.find((m) => m.id === method);

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    if (checkoutOpen) {
      setStep("details");
      setMethod("LTC");
      setOrderId(null);
      setDelivered(null);
      setDeliveredFile(null);
      setPollCount(0);
      setFoundTx(false);
      setChecking(false);
      setPollingStarted(false);
      setEmailSent(false);
      isPollingRef.current = false;
    } else {
      stopPolling();
    }
  }, [checkoutOpen, checkoutTarget, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleContinue() {
    setCreating(true);
    try {
      if (isCartMode) {
        // CART MODE: create multiple orders with a shared cartGroup
        const res = await fetch("/api/orders/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cartItems.map((i) => ({ itemId: i.id, itemType: "product" as const })),
            paymentMethod: method,
            buyerEmail: email || undefined,
            buyerDiscord: discord || undefined,
            discountCode: discountCode || undefined,
          }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Failed to create cart orders");
        setCartGroupId(data.cartGroup);
        setCryptoAmount(data.totalCrypto);
        const methodInfo = methods.find((mm) => mm.id === method);
        setAddress(methodInfo?.address ?? "");
        if (data.isFree) {
          // All items are free — show success immediately with deliveries (includes file info)
          setCartDeliveries(data.deliveries || data.orders.map((o: any) => ({
            orderNumber: o.orderNumber,
            itemName: o.itemName,
            deliveredContent: o.deliveredContent,
            orderId: o.id,
            productId: o.productId,
            fileName: null,
            fileSize: null,
            codeLink: null,
          })));
          setEmailSent(!!data.emailSent);
          setStep("success");
        } else {
          setStep("pay");
          // Polling starts when user clicks "Buy" — not automatically
        }
      } else if (target) {
        // SINGLE ITEM MODE (existing flow)
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType: target.itemType,
            itemId: target.itemId,
            paymentMethod: method,
            buyerEmail: email || undefined,
            buyerDiscord: discord || undefined,
            discountCode: discountCode || undefined,
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
          setDeliveredFile(data.file ?? null);
          setEmailSent(!!data.emailSent);
          setStep("success");
        } else {
          setStep("pay");
          // Polling starts when user clicks "Buy" — not automatically
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // Auto-polling loop — uses refs to avoid stale closures
  const startPolling = useCallback((id: string) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    const poll = async () => {
      if (!isPollingRef.current) return;
      setChecking(true);
      try {
        const res = await fetch(`/api/orders/${id}/check`);
        const data = await safeJson(res);
        if (!isPollingRef.current) return; // stopped during fetch
        setPollCount((c) => c + 1);
        if (data.verified) {
          stopPolling();
          setDelivered(data.delivered || "Payment auto-detected!");
          setDeliveredFile(data.file ?? null);
          setEmailSent(!!data.emailSent);
          setStep("success");
          toast.success("Payment detected! 🎉");
          // Clear discount after successful purchase
          localStorage.removeItem("zev-discount");
          setDiscountPct(0);
          setDiscountCode(null);
          return;
        }
        if (data.found) {
          setFoundTx(true);
        }
      } catch {
        /* keep trying */
      } finally {
        if (isPollingRef.current) setChecking(false);
      }
      // Schedule next poll — only if still polling
      if (isPollingRef.current) {
        pollTimer.current = setTimeout(poll, 10000);
      }
    };
    poll();
  }, [stopPolling]);

  // Cart auto-polling loop — polls /api/orders/cart/[groupId]/check
  const startCartPolling = useCallback((groupId: string) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    const poll = async () => {
      if (!isPollingRef.current) return;
      setChecking(true);
      try {
        const res = await fetch(`/api/orders/cart/${groupId}/check`);
        const data = await safeJson(res);
        if (!isPollingRef.current) return;
        setPollCount((c) => c + 1);
        if (data.verified) {
          stopPolling();
          setCartDeliveries(data.deliveries || []);
          setEmailSent(!!data.emailSent);
          setStep("success");
          toast.success("Payment detected! All items delivered! 🎉");
          localStorage.removeItem("zev-discount");
          setDiscountPct(0);
          setDiscountCode(null);
          // Clear the cart after successful purchase
          clearCart();
          return;
        }
        if (data.found) {
          setFoundTx(true);
        }
      } catch {
        /* keep trying */
      } finally {
        if (isPollingRef.current) setChecking(false);
      }
      if (isPollingRef.current) {
        pollTimer.current = setTimeout(poll, 10000);
      }
    };
    poll();
  }, [stopPolling, clearCart]);

  // "Buy" button — starts the live blockchain polling
  function handleBuy() {
    if (pollingStarted) return;
    setPollingStarted(true);
    if (cartGroupId) {
      startCartPolling(cartGroupId);
    } else if (orderId) {
      startPolling(orderId);
    }
  }

  // Manual check button
  async function checkNow() {
    if (checking) return;
    if (!orderId && !cartGroupId) return;
    setChecking(true);
    try {
      // Cart mode or single mode
      const url = cartGroupId
        ? `/api/orders/cart/${cartGroupId}/check`
        : `/api/orders/${orderId}/check`;
      const res = await fetch(url);
      const data = await safeJson(res);
      setPollCount((c) => c + 1);
      if (data.verified) {
        stopPolling();
        if (cartGroupId) {
          setCartDeliveries(data.deliveries || []);
        } else {
          setDelivered(data.delivered || "Payment verified!");
          setDeliveredFile(data.file ?? null);
        }
        setEmailSent(!!data.emailSent);
        setStep("success");
        toast.success("Payment detected! 🎉");
        if (cartGroupId) clearCart();
      } else {
        if (data.found) setFoundTx(true);
        toast.info(data.found ? "Transaction detected — confirming..." : "No payment detected yet");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
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

        {(target || isCartMode) && (
          <div className="max-h-[75vh] overflow-y-auto">
            {/* Item summary — compact (cart mode shows multiple items) */}
            {isCartMode ? (
              <div className="border-b border-border/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Cart ({cartItems.length} {cartItems.length === 1 ? "item" : "items"})
                  </span>
                  <span className="text-sm font-bold text-gold">${cartTotalUSD.toFixed(2)}</span>
                </div>
                <div className="max-h-32 space-y-2 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded">
                        <ItemImage src={item.image} alt={item.name} seed={item.id} />
                      </div>
                      <span className="flex-1 truncate text-xs">{item.name}</span>
                      <span className="text-xs font-medium text-gold">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {selectedMethod && !isFree && step === "pay" && (
                  <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/30 pt-2">
                    <span className="text-xs text-muted-foreground">{selectedMethod.symbol}</span>
                    <span className="text-sm font-bold" style={{ color: selectedMethod.color }}>
                      {cryptoAmount.toFixed(method === "BTC" || method === "LTC" ? 6 : 4)}
                    </span>
                  </div>
                )}
              </div>
            ) : target ? (
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
            ) : null}

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
                      {discountPct > 0 && (
                        <div className="flex justify-between mb-1 text-xs">
                          <span className="text-muted-foreground">Original Price</span>
                          <span className="text-muted-foreground line-through">${originalPrice.toFixed(2)}</span>
                        </div>
                      )}
                      {discountPct > 0 && (
                        <div className="flex justify-between mb-1 text-xs">
                          <span className="text-emerald-glow">Discount ({discountPct}%)</span>
                          <span className="text-emerald-glow">-${(originalPrice - discountedPrice).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{discountPct > 0 ? "Discounted Total" : "Total"}</span>
                        <span className="font-bold text-gold">
                          {(effectivePrice / (prices[method] || 1)).toFixed(method === "BTC" || method === "LTC" ? 6 : 4)} {method}
                        </span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-xs text-muted-foreground">
                        <span>= ${effectivePrice.toFixed(2)} USD</span>
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

              {/* STEP 2: Pay — shows address + amount, Buy button starts live checking */}
              {step === "pay" && selectedMethod && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
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
                    <div className="text-xs text-muted-foreground">≈ ${effectivePrice.toFixed(2)} USD</div>
                  </div>

                  {/* Network */}
                  <div className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-medium">{selectedMethod.chain}</span>
                  </div>

                  <a href={selectedMethod.explorer} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-emerald-glow hover:underline">
                    View on {selectedMethod.explorer.replace("https://","")} <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* Buy button — starts live blockchain checking */}
                  {!pollingStarted ? (
                    <Button
                      onClick={handleBuy}
                      className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
                      size="lg"
                    >
                      <Zap className="h-5 w-5" />
                      Buy
                    </Button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-lg bg-emerald-500/10 p-4 text-center ring-1 ring-emerald-glow/30"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-glow" />
                        <span className="text-sm font-medium text-emerald-glow">
                          Checking for live payment...
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Send the exact amount to the address above. We&apos;ll detect your payment automatically and deliver your {isCartMode ? "items" : "product"} instantly.
                      </p>
                    </motion.div>
                  )}

                  <button onClick={() => { stopPolling(); setPollingStarted(false); setStep("details"); }} className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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

                  {/* Cart mode: show multiple deliveries */}
                  {isCartMode && cartDeliveries && cartDeliveries.length > 0 && (
                    <div className="space-y-2">
                      {cartDeliveries.map((d, i) => (
                        <div key={i} className="rounded-lg glass p-3 ring-1 ring-emerald-glow/30">
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-glow">
                            <Coins className="h-3.5 w-3.5" /> {i + 1}. {d.itemName}
                          </div>
                          {d.deliveredContent && (
                            <>
                              <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2.5 text-xs font-mono">
                                {d.deliveredContent}
                              </pre>
                              <Button size="sm" variant="outline" className="mt-2 gap-1 text-xs" onClick={() => copy(d.deliveredContent, `Item${i}`)}>
                                {copied === `Item${i}` ? <Check className="h-3 w-3 text-emerald-glow" /> : <Copy className="h-3 w-3" />} Copy
                              </Button>
                            </>
                          )}
                          {/* Download button — only show if there's an attached file */}
                          {d.fileName && d.orderId && (
                            <div className="mt-2 rounded-lg bg-background/60 p-2.5 ring-1 ring-gold/20">
                              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gold">
                                <FileArchive className="h-3.5 w-3.5" /> {d.fileName}
                                {typeof d.fileSize === "number" && d.fileSize > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ({d.fileSize < 1024 * 1024 ? `${(d.fileSize / 1024).toFixed(0)} KB` : `${(d.fileSize / (1024 * 1024)).toFixed(1)} MB`})
                                  </span>
                                )}
                              </div>
                              <Button asChild size="sm" className="w-full gap-1.5 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold text-xs">
                                <a href={`/api/orders/${d.orderId}/download`} download={d.fileName}>
                                  <Download className="h-3.5 w-3.5" /> Download ZIP
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Single item mode: show single delivery */}
                  {!isCartMode && delivered && (
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

                  {deliveredFile && orderId && (
                    <div className="rounded-lg glass p-3 ring-1 ring-gold/30">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gold">
                        <FileArchive className="h-3.5 w-3.5" /> Attached File
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded bg-background/60 px-2.5 py-2">
                        <span className="truncate text-xs font-mono">{deliveredFile.name}</span>
                        {typeof deliveredFile.size === "number" && deliveredFile.size > 0 && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {deliveredFile.size < 1024 * 1024
                              ? `${(deliveredFile.size / 1024).toFixed(0)} KB`
                              : `${(deliveredFile.size / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                        )}
                      </div>
                      <Button asChild size="sm" className="mt-2 w-full gap-1.5 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold text-xs">
                        <a href={`/api/orders/${orderId}/download`} download={deliveredFile.name}>
                          <Download className="h-3.5 w-3.5" /> Download ZIP
                        </a>
                      </Button>
                    </div>
                  )}

                  {emailSent && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-200 ring-1 ring-emerald-glow/20">
                      <Mail className="h-3.5 w-3.5" /> A copy was sent to your email.
                    </div>
                  )}

                  <div className="rounded-lg bg-accent/20 p-2.5 text-center text-xs text-muted-foreground">
                    💾 Your purchase is saved in <button onClick={() => { closeCheckout(); }} className="text-emerald-glow underline">My Orders</button> — you can re-download anytime.
                  </div>

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

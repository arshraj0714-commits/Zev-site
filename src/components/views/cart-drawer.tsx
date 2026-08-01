"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Trash2, Zap, ArrowRight, Package } from "lucide-react";
import { useZev } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ItemImage } from "@/components/site/item-image";
import { toast } from "sonner";

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, removeFromCart, clearCart, openCartCheckout, cartTotal, go } = useZev();

  const total = cartTotal();

  function handleCheckout() {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    // Check if all items are paid (non-free) — free items don't need cart checkout
    const paidItems = cart.filter((i) => i.type !== "free" && i.price > 0);
    const freeItems = cart.filter((i) => i.type === "free" || i.price === 0);

    if (paidItems.length === 0 && freeItems.length > 0) {
      toast.info("All items in your cart are free. Use 'Get Free' on each product page instead.");
      return;
    }

    openCartCheckout(paidItems.length > 0 ? cart : freeItems);
    setCartOpen(false);
  }

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background/95 backdrop-blur-xl ring-1 ring-border/40"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/30 p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-glow" />
                <h2 className="text-lg font-semibold">Your Cart</h2>
                {cart.length > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-glow ring-1 ring-emerald-glow/30">
                    {cart.length}
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 ring-1 ring-border/30">
                    <Package className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-lg font-medium">Your cart is empty</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Browse the marketplace and add products to your cart.
                  </p>
                  <Button
                    onClick={() => { go("products"); setCartOpen(false); }}
                    className="mt-6 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
                  >
                    Browse Marketplace
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex gap-3 rounded-xl glass p-3 ring-1 ring-border/30"
                    >
                      {/* Image */}
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                        <ItemImage
                          src={item.image}
                          alt={item.name}
                          seed={item.id}
                          className="h-full w-full"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <div className="mt-0.5 flex items-center gap-2">
                              {item.type === "free" ? (
                                <Badge className="bg-emerald-500/15 text-emerald-glow">FREE</Badge>
                              ) : (
                                <span className="text-sm font-semibold text-gold">${item.price.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              removeFromCart(item.id);
                              toast.info(`${item.name} removed from cart`);
                            }}
                            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                            aria-label="Remove from cart"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Clear cart button */}
                  <button
                    onClick={() => {
                      clearCart();
                      toast.info("Cart cleared");
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear all items
                  </button>
                </div>
              )}
            </div>

            {/* Footer with total + checkout */}
            {cart.length > 0 && (
              <div className="border-t border-border/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total ({cart.length} {cart.length === 1 ? "item" : "items"})</span>
                  <span className="text-2xl font-bold text-gold">${total.toFixed(2)}</span>
                </div>
                <p className="mb-3 text-center text-xs text-muted-foreground">
                  Pay once with crypto — all items delivered instantly after confirmation.
                </p>
                <Button
                  onClick={handleCheckout}
                  className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
                  size="lg"
                >
                  <Zap className="h-5 w-5" />
                  Checkout · ${total.toFixed(2)}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

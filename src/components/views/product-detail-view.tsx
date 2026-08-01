"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, Zap, Shield, Check, FileArchive,
  Tag, Folder, TrendingUp, Loader2,
} from "lucide-react";
import { useZev } from "@/lib/store";
import { useProducts, type Product } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ItemImage } from "@/components/site/item-image";
import { toast } from "sonner";

export function ProductDetailView() {
  const { selectedProductId, go, addToCart, openCheckout } = useZev();
  const { data: productsData, isLoading } = useProducts("all");
  const [addingToCart, setAddingToCart] = useState(false);

  const products = productsData?.products || [];
  const product: Product | undefined = products.find((p) => p.id === selectedProductId);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-glow" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="rounded-2xl bg-accent/10 p-4 ring-1 ring-border/30">
          <p className="text-lg font-semibold">Product not found</p>
          <p className="mt-1 text-sm text-muted-foreground">This product may have been removed or doesn&apos;t exist.</p>
        </div>
        <Button onClick={() => go("products")} className="mt-6 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </Button>
      </div>
    );
  }

  const isFree = product.type === "free";
  const tags = product.tags ? product.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

  function handleAddToCart() {
    if (!product) return;
    setAddingToCart(true);
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      type: product.type,
    });
    setTimeout(() => setAddingToCart(false), 600);
    toast.success(`${product.name} added to cart!`);
  }

  function handleBuyNow() {
    if (!product) return;
    openCheckout({
      itemType: "product",
      itemId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      description: product.description,
    });
  }

  function handleGetFree() {
    if (!product) return;
    openCheckout({
      itemType: "product",
      itemId: product.id,
      name: product.name,
      price: 0,
      image: product.image,
      description: product.description,
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6"
      >
        <button
          onClick={() => go("products")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </button>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Product Image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="relative aspect-square overflow-hidden rounded-2xl glass-strong ring-1 ring-border/40">
            <ItemImage
              src={product.image}
              alt={product.name}
              seed={product.id}
              className="h-full w-full"
              contain
            />
            <div className="absolute left-4 top-4 flex gap-2">
              {isFree ? (
                <Badge className="bg-emerald-500 text-emerald-950">FREE</Badge>
              ) : (
                <Badge className="bg-gold text-gold-foreground">PAID</Badge>
              )}
              {product.featured && (
                <Badge className="bg-primary text-primary-foreground">Featured</Badge>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl glass p-3 text-center ring-1 ring-border/30">
              <TrendingUp className="mx-auto h-4 w-4 text-emerald-glow" />
              <p className="mt-1 text-xs text-muted-foreground">Sales</p>
              <p className="text-sm font-semibold">{product.salesCount}</p>
            </div>
            <div className="rounded-xl glass p-3 text-center ring-1 ring-border/30">
              <Folder className="mx-auto h-4 w-4 text-gold" />
              <p className="mt-1 text-xs text-muted-foreground">Category</p>
              <p className="truncate text-sm font-semibold">{product.folder || "General"}</p>
            </div>
            <div className="rounded-xl glass p-3 text-center ring-1 ring-border/30">
              <Shield className="mx-auto h-4 w-4 text-emerald-glow" />
              <p className="mt-1 text-xs text-muted-foreground">Delivery</p>
              <p className="text-sm font-semibold">Instant</p>
            </div>
          </div>
        </motion.div>

        {/* Right: Product Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col"
        >
          {/* Title & Price */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              {isFree ? (
                <span className="text-2xl font-bold text-emerald-glow">FREE</span>
              ) : (
                <span className="text-2xl font-bold text-gold">${product.price.toFixed(2)}</span>
              )}
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">Pay with LTC, BTC, SOL, or USDT</span>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="mb-6 flex-1">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</h2>
            <div className="rounded-xl glass p-4 ring-1 ring-border/30">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {product.description}
              </p>
            </div>
          </div>

          {/* File info (if attached) */}
          {product.fileName && (
            <div className="mb-6">
              <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-glow/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
                  <FileArchive className="h-5 w-5 text-emerald-glow" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{product.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.fileSize ? `${(product.fileSize / 1024 / 1024).toFixed(1)} MB · ` : ""}Available for download after purchase
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {isFree ? (
              <Button
                onClick={handleGetFree}
                size="lg"
                className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
              >
                <Zap className="h-5 w-5" />
                Get Free
              </Button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    variant="outline"
                    size="lg"
                    className="gap-2 glass bg-background/40 hover:bg-background/60"
                  >
                    {addingToCart ? (
                      <Check className="h-5 w-5 text-emerald-glow" />
                    ) : (
                      <ShoppingCart className="h-5 w-5" />
                    )}
                    {addingToCart ? "Added!" : "Add to Cart"}
                  </Button>
                  <Button
                    onClick={handleBuyNow}
                    size="lg"
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
                  >
                    <Zap className="h-5 w-5" />
                    Buy Now
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Buy Now for instant delivery, or Add to Cart to purchase multiple products at once.
                </p>
              </>
            )}
          </div>

          {/* Trust badges */}
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/30 pt-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <Shield className="h-4 w-4 text-emerald-glow" />
              <p className="text-[11px] text-muted-foreground">On-chain verified</p>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <Zap className="h-4 w-4 text-gold" />
              <p className="text-[11px] text-muted-foreground">Instant delivery</p>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <Check className="h-4 w-4 text-emerald-glow" />
              <p className="text-[11px] text-muted-foreground">7-day refund</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

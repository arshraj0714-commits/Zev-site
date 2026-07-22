"use client";

import { motion } from "framer-motion";
import { ShoppingCart, Folder, Download, Coins, Star } from "lucide-react";
import { TiltCard } from "./tilt-card";
import { ItemImage } from "./item-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useZev } from "@/lib/store";

export interface CardItem {
  id: string;
  name: string;
  description: string;
  image?: string | null;
  price: number;
  type?: string; // for products: "paid" | "free"
  category?: string | null;
  folder?: string | null;
  tags?: string | null;
  codeLink?: string | null;
  salesCount?: number;
  stars?: number;
  kind: "product" | "stock" | "opensource";
}

export function MarketplaceCard({ item, index = 0 }: { item: CardItem; index?: number }) {
  const { openCheckout, go } = useZev();

  const tags = item.tags
    ? item.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3)
    : [];

  const isFree = item.kind === "opensource" || item.type === "free" || item.price === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.4) }}
    >
      <TiltCard className="h-full rounded-2xl" intensity={8}>
        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl glass halo ring-1 ring-border/40">
          {/* Image */}
          <div className="relative h-44 overflow-hidden">
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110">
              <ItemImage src={item.image} alt={item.name} seed={item.name} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

            {/* Badges */}
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {isFree ? (
                <Badge className="bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400">
                  FREE
                </Badge>
              ) : (
                <Badge className="bg-gold/90 text-black hover:bg-gold">
                  <Coins className="mr-1 h-3 w-3" /> PAID
                </Badge>
              )}
              {item.category && (
                <Badge variant="secondary" className="glass">
                  {item.category}
                </Badge>
              )}
            </div>

            {/* Price */}
            {!isFree && (
              <div className="absolute right-3 top-3 rounded-lg bg-background/80 px-2.5 py-1 text-sm font-bold text-gold backdrop-blur ring-1 ring-gold/30">
                ${item.price.toFixed(2)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col p-4">
            <h3 className="line-clamp-1 text-lg font-bold text-foreground">{item.name}</h3>
            <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">
              {item.description}
            </p>

            {/* Meta */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {item.folder && (
                <span className="inline-flex items-center gap-1">
                  <Folder className="h-3 w-3" /> {item.folder}
                </span>
              )}
              {typeof item.salesCount === "number" && item.salesCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Download className="h-3 w-3" /> {item.salesCount} sold
                </span>
              )}
              {typeof item.stars === "number" && item.stars > 0 && (
                <span className="inline-flex items-center gap-1 text-gold">
                  <Star className="h-3 w-3 fill-gold" /> {item.stars}
                </span>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-accent/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              {item.kind === "opensource" ? (
                <Button
                  asChild
                  className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
                >
                  <a href={item.codeLink || "#"} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" /> Get Code
                  </a>
                </Button>
              ) : isFree ? (
                <Button
                  onClick={() =>
                    openCheckout({
                      itemType: "product",
                      itemId: item.id,
                      name: item.name,
                      price: 0,
                      image: item.image,
                      description: item.description,
                    })
                  }
                  className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
                >
                  <Download className="h-4 w-4" /> Get Free
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    openCheckout({
                      itemType: item.kind,
                      itemId: item.id,
                      name: item.name,
                      price: item.price,
                      image: item.image,
                      description: item.description,
                    })
                  }
                  className="flex-1 gap-2 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold shadow-lg shadow-gold/20"
                >
                  <ShoppingCart className="h-4 w-4" /> Buy Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
}

export function MarketplaceCardSkeleton() {
  return (
    <div className="h-full rounded-2xl glass overflow-hidden">
      <div className="h-44 shimmer" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 rounded shimmer" />
        <div className="h-4 w-full rounded shimmer" />
        <div className="h-4 w-2/3 rounded shimmer" />
        <div className="h-9 w-full rounded shimmer" />
      </div>
    </div>
  );
}

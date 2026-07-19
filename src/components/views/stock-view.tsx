"use client";

import { useState, useMemo } from "react";
import { Search, Package, Coins, Box, ShieldCheck } from "lucide-react";
import { useStock } from "@/hooks/use-data";
import { SectionHeading } from "@/components/site/section-heading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ItemImage } from "@/components/site/item-image";
import { TiltCard } from "@/components/site/tilt-card";
import { useZev } from "@/lib/store";
import { motion } from "framer-motion";

export function StockView() {
  const { data, isLoading } = useStock();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const { openCheckout } = useZev();

  const items = data?.items ?? [];
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category!));
    return ["all", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (cat !== "all") list = list.filter((i) => i.category === cat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.tags ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, cat, query]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Stock & Accounts"
        title="Verified Credentials Market"
        subtitle="Emails, accounts, and digital credentials. Each purchase delivers credentials instantly after on-chain payment verification."
      />

      <div className="mt-6 flex items-center justify-center gap-2 rounded-xl glass px-4 py-3 ring-1 ring-emerald-glow/20">
        <ShieldCheck className="h-4 w-4 text-emerald-glow" />
        <span className="text-sm text-muted-foreground">
          Credentials are encrypted and only revealed after your payment is confirmed on-chain.
        </span>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c}
              variant={cat === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCat(c)}
              className={cat === c ? "bg-gradient-to-r from-gold to-amber-400 text-black" : "glass"}
            >
              {c === "all" ? "All Categories" : c}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stock..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="glass pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 rounded-2xl glass shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No stock available</h3>
          <p className="mt-1 text-sm text-muted-foreground">New stock is added regularly. Check back soon.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, i) => {
            const tags = item.tags ? item.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3) : [];
            const available = item.quantity - item.soldCount;
            const lowStock = available <= 5;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: Math.min(i * 0.06, 0.4) }}
              >
                <TiltCard className="h-full rounded-2xl" intensity={8}>
                  <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl glass halo ring-1 ring-border/40">
                    <div className="relative h-40 overflow-hidden">
                      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110">
                        <ItemImage src={item.image} alt={item.name} seed={item.name} />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                      <div className="absolute left-3 top-3 flex gap-1.5">
                        <Badge className="bg-gold/90 text-black hover:bg-gold">
                          <Coins className="mr-1 h-3 w-3" /> PAID
                        </Badge>
                        {item.category && (
                          <Badge variant="secondary" className="glass">{item.category}</Badge>
                        )}
                      </div>
                      <div className="absolute right-3 top-3 rounded-lg bg-background/80 px-2.5 py-1 text-sm font-bold text-gold backdrop-blur ring-1 ring-gold/30">
                        ${item.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-1 text-lg font-bold">{item.name}</h3>
                      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">{item.description}</p>
                      <div className="mt-3 flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className={`inline-flex items-center gap-1 ${lowStock ? "text-rose-400" : ""}`}>
                          <Box className="h-3 w-3" /> {available} left
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" /> {item.soldCount} sold
                        </span>
                      </div>
                      {tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {tags.map((t) => (
                            <span key={t} className="rounded-md bg-accent/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">#{t}</span>
                          ))}
                        </div>
                      )}
                      <Button
                        onClick={() =>
                          openCheckout({
                            itemType: "stock",
                            itemId: item.id,
                            name: item.name,
                            price: item.price,
                            image: item.image,
                            description: item.description,
                          })
                        }
                        disabled={available <= 0}
                        className="mt-4 gap-2 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold shadow-lg shadow-gold/20 disabled:opacity-50"
                      >
                        {available <= 0 ? "Sold Out" : (<><Coins className="h-4 w-4" /> Buy & Reveal</>)}
                      </Button>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Package, Filter } from "lucide-react";
import { useProducts } from "@/hooks/use-data";
import { MarketplaceCard, MarketplaceCardSkeleton, type CardItem } from "@/components/site/marketplace-card";
import { SectionHeading } from "@/components/site/section-heading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useZev } from "@/lib/store";
import { cn } from "@/lib/utils";

type FilterType = "all" | "paid" | "free";

export function ProductsView() {
  const { pendingSearchQuery, clearPendingSearchQuery } = useZev();
  const [filter, setFilter] = useState<FilterType>("all");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useProducts("all");

  // Pick up a search term handed off from the navbar's global search bar, once.
  useEffect(() => {
    if (pendingSearchQuery !== null) {
      setQuery(pendingSearchQuery);
      clearPendingSearchQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSearchQuery]);

  const products = data?.products ?? [];

  const filtered = useMemo(() => {
    let list = products;
    if (filter !== "all") list = list.filter((p) => p.type === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tags ?? "").toLowerCase().includes(q) ||
          (p.folder ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, filter, query]);

  const counts = {
    all: products.length,
    paid: products.filter((p) => p.type === "paid").length,
    free: products.filter((p) => p.type === "free").length,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Marketplace"
        title="Discord Tools & Bots"
        subtitle="Premium and free Discord automation tools. Buy securely with crypto or grab the free ones instantly."
      />

      {/* Controls */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            { id: "all", label: "All", count: counts.all },
            { id: "paid", label: "Paid", count: counts.paid },
            { id: "free", label: "Free", count: counts.free },
          ] as { id: FilterType; label: string; count: number }[]).map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.id)}
              className={cn(
                "gap-2",
                filter === f.id
                  ? f.id === "paid"
                    ? "bg-gradient-to-r from-gold to-amber-400 text-black"
                    : f.id === "free"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950"
                    : "bg-primary text-primary-foreground"
                  : "glass"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {f.label}
              <span className="rounded-full bg-background/40 px-1.5 text-xs">{f.count}</span>
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools, bots, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="glass pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketplaceCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass ring-1 ring-border/40">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <MarketplaceCard
              key={p.id}
              index={i}
              item={{
                id: p.id, name: p.name, description: p.description, image: p.image,
                price: p.price, type: p.type, folder: p.folder, tags: p.tags,
                codeLink: p.codeLink, salesCount: p.salesCount, kind: "product",
              } as CardItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

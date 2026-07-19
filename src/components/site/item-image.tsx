"use client";

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  seed?: string;
}

// Deterministic gradient generator from a seed string
function gradientFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, oklch(0.5 0.15 ${h1}), oklch(0.45 0.18 ${h2}))`;
}

export function ItemImage({ src, alt, className, seed = alt }: ItemImageProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{ background: gradientFromSeed(seed) }}
    >
      <div className="flex flex-col items-center gap-2 text-white/70">
        <ImageIcon className="h-8 w-8" />
        <span className="text-xs font-medium uppercase tracking-wider opacity-70">Zev</span>
      </div>
    </div>
  );
}

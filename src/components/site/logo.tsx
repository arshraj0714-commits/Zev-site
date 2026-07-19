"use client";

import { motion } from "framer-motion";

// Clean, simple "Z" logo — pure SVG, no background, emerald-to-gold gradient
export function ZevLogo({ className = "h-8 w-8", animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} ${animated ? "animate-float-3d" : ""}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 0 8px oklch(0.75 0.19 158 / 0.35))" }}
    >
      <defs>
        <linearGradient id="zev-z-grad" x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.82 0.17 158)" />
          <stop offset="0.5" stopColor="oklch(0.85 0.14 88)" />
          <stop offset="1" stopColor="oklch(0.72 0.17 150)" />
        </linearGradient>
      </defs>
      {/* Simple Z mark — clean, no hexagon, no background */}
      <path
        d="M20 20 L44 20 L22 44 L46 44"
        stroke="url(#zev-z-grad)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ZevLogoFlat({ className = "h-8 w-8" }: { className?: string }) {
  return <ZevLogo className={className} />;
}

export function ZevWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <ZevLogo className="h-8 w-8" />
      </motion.div>
      <div className="flex flex-col leading-none">
        <span className="text-xl font-bold tracking-tight text-aurora">Zev</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">by Arsh</span>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

export function ZevLogo({ className = "h-9 w-9", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <div className={`relative ${className}`}>
      {/* Glow behind logo */}
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-60"
        style={{ background: "radial-gradient(circle, oklch(0.75 0.19 158 / 0.5), transparent 70%)" }}
      />
      <img
        src="/img/zev-logo-3d.png"
        alt="Zev Logo"
        className={`relative h-full w-full object-contain drop-shadow-[0_4px_12px_oklch(0.75_0.19_158_/_0.4)] ${animated ? "animate-float-3d" : ""}`}
      />
    </div>
  );
}

export function ZevLogoFlat({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <img
        src="/img/zev-logo-3d.png"
        alt="Zev Logo"
        className="relative h-full w-full object-contain drop-shadow-[0_2px_8px_oklch(0.75_0.19_158_/_0.3)]"
      />
    </div>
  );
}

export function ZevWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <motion.div
        initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="scene-3d"
      >
        <ZevLogo className="h-10 w-10" />
      </motion.div>
      <div className="flex flex-col leading-none">
        <span className="text-xl font-bold tracking-tight text-aurora">Zev</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">by Arsh</span>
      </div>
    </div>
  );
}

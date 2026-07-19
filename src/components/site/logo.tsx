"use client";

import { motion } from "framer-motion";

export function ZevLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="zev-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.82 0.17 158)" />
          <stop offset="0.5" stopColor="oklch(0.85 0.14 88)" />
          <stop offset="1" stopColor="oklch(0.7 0.16 145)" />
        </linearGradient>
        <filter id="zev-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M32 3 L55 16.5 L55 47.5 L32 61 L9 47.5 L9 16.5 Z"
        stroke="url(#zev-grad)"
        strokeWidth="2"
        fill="oklch(0.15 0.015 165 / 0.6)"
      />
      <path
        d="M22 22 L42 22 L24 42 L44 42"
        stroke="url(#zev-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#zev-glow)"
      />
    </svg>
  );
}

export function ZevWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <motion.div
        initial={{ rotate: -10, scale: 0.8 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <ZevLogo className="h-9 w-9" />
      </motion.div>
      <div className="flex flex-col leading-none">
        <span className="text-xl font-bold tracking-tight text-gradient-mixed">Zev</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">by Arsh</span>
      </div>
    </div>
  );
}

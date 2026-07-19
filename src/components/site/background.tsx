"use client";

import { motion } from "framer-motion";

export function Background3D() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Grid */}
      <div className="absolute inset-0 grid-bg opacity-60" />

      {/* Floating 3D orbs */}
      <motion.div
        className="absolute -top-32 left-1/4 h-[30rem] w-[30rem] rounded-full blur-[130px] orb-1"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.17 158 / 0.22), transparent 70%)" }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 h-[34rem] w-[34rem] rounded-full blur-[150px] orb-2"
        style={{ background: "radial-gradient(circle, oklch(0.82 0.14 88 / 0.16), transparent 70%)" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full blur-[130px] orb-1"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.15 190 / 0.14), transparent 70%)" }}
      />

      {/* Animated mesh lines */}
      <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mesh-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.75 0.19 158)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 88)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.path
            key={i}
            d={`M ${-100 + i * 250} ${800} Q ${400 + i * 200} ${200 - i * 50} ${2000} ${400 + i * 100}`}
            stroke="url(#mesh-line)"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 4, delay: i * 0.4, repeat: Infinity, repeatType: "reverse" }}
          />
        ))}
      </svg>

      {/* Top vignette */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent" />
      {/* Bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

export function Background3D() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <motion.div
        className="absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.17 158 / 0.18), transparent 70%)" }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 h-[32rem] w-[32rem] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, oklch(0.82 0.14 88 / 0.14), transparent 70%)" }}
        animate={{ x: [0, -50, 0], y: [0, 60, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.15 190 / 0.12), transparent 70%)" }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glow?: "emerald" | "gold" | "none";
}

export function TiltCard({ children, className = "", intensity = 12, glow = "emerald" }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (py - 0.5) * -intensity;
    const ry = (px - 0.5) * intensity;
    setTransform(`perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`);
    setGlowPos({ x: px * 100, y: py * 100 });
  }

  function handleLeave() {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg)");
    setHovered(false);
  }

  const glowColor =
    glow === "gold"
      ? "oklch(0.82 0.14 88 / 0.18)"
      : glow === "emerald"
      ? "oklch(0.75 0.19 158 / 0.18)"
      : "transparent";

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      style={{ transform, transformStyle: "preserve-3d" }}
      className={`relative transition-transform duration-300 ease-out ${className}`}
    >
      {/* Glow overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(400px circle at ${glowPos.x}% ${glowPos.y}%, ${glowColor}, transparent 50%)`,
        }}
      />
      <div style={{ transform: "translateZ(20px)" }}>{children}</div>
    </motion.div>
  );
}

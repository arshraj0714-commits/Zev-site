"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Shield, Sparkles } from "lucide-react";
import { useZev, type ViewId } from "@/lib/store";
import { ZevWordmark } from "./logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { id: ViewId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "products", label: "Marketplace" },
  { id: "opensource", label: "Open Source" },
  { id: "stock", label: "Stock & Accounts" },
  { id: "upload", label: "Upload" },
  { id: "about", label: "About" },
];

export function Navbar() {
  const { view, go, mobileNavOpen, setMobileNav, adminMode, toggleAdmin } = useZev();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="glass-strong border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => go("home")} className="shrink-0">
            <ZevWordmark />
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={cn(
                  "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  view === item.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {view === item.id && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-primary/15 ring-1 ring-primary/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAdmin}
              className={cn(
                "hidden sm:flex gap-2",
                adminMode && "text-gold"
              )}
            >
              <Shield className="h-4 w-4" />
              {adminMode ? "Admin" : "User"}
            </Button>
            <Button
              onClick={() => go("products")}
              size="sm"
              className="hidden sm:flex gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-lg shadow-emerald-500/20"
            >
              <Sparkles className="h-4 w-4" />
              Browse Tools
            </Button>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileNav(!mobileNavOpen)}
              className="lg:hidden rounded-lg p-2 text-foreground hover:bg-accent"
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden glass-strong border-b border-border/40"
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={cn(
                    "rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors",
                    view === item.id
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAdmin}
                className="mt-2 justify-start gap-2"
              >
                <Shield className="h-4 w-4" />
                {adminMode ? "Admin Mode: ON" : "Admin Mode: OFF"}
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

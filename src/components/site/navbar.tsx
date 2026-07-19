"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles, LogOut, LayoutDashboard, User as UserIcon, ClipboardList } from "lucide-react";
import { useZev, type ViewId } from "@/lib/store";
import { ZevWordmark } from "./logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { id: ViewId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "products", label: "Marketplace" },
  { id: "opensource", label: "Open Source" },
  { id: "stock", label: "Stock & Accounts" },
  { id: "about", label: "About" },
];

export function Navbar() {
  const { view, go, mobileNavOpen, setMobileNav, admin, logout } = useZev();

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 sm:px-4 sm:pt-4">
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="glass-bubble glass-bubble-hover mx-auto max-w-6xl rounded-2xl transition-all duration-300"
      >
        <div className="flex h-14 items-center justify-between px-3 sm:px-5">
          <button onClick={() => go("home")} className="shrink-0">
            <ZevWordmark />
          </button>

          {/* Desktop nav — bubble pills */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={cn(
                  "relative rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-300",
                  view === item.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {view === item.id && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/25 to-gold/15 ring-1 ring-emerald-glow/40 shadow-[0_0_20px_-5px_oklch(0.75_0.19_158_/_0.4),inset_0_1px_0_0_oklch(1_0_0_/_0.15)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Account / Sign In */}
            {admin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 rounded-xl">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-gold text-xs font-bold text-black shadow-[0_0_12px_-2px_oklch(0.82_0.14_88_/_0.5)]">
                      {admin.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[90px] truncate sm:inline">
                      {admin.name.split(" ")[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass-bubble">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{admin.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{admin.email}</p>
                      {admin.role === "admin" && (
                        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold ring-1 ring-gold/30">
                          Admin
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => go("orders")} className="gap-2 cursor-pointer">
                    <ClipboardList className="h-4 w-4" /> My Orders
                  </DropdownMenuItem>
                  {admin.role === "admin" && (
                    <DropdownMenuItem onClick={() => go("upload")} className="gap-2 cursor-pointer">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => go("about")} className="gap-2 cursor-pointer">
                    <UserIcon className="h-4 w-4" /> About
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="gap-2 cursor-pointer text-rose-400 focus:text-rose-400">
                    <LogOut className="h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => go("auth")}
                className="gap-2 rounded-xl"
              >
                <UserIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}

            <Button
              onClick={() => go("products")}
              size="sm"
              className="hidden sm:flex gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 animate-btn-glow"
            >
              <Sparkles className="h-4 w-4" />
              Browse Tools
            </Button>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileNav(!mobileNavOpen)}
              className="lg:hidden rounded-xl p-2 text-foreground hover:bg-white/5"
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile nav — bubble dropdown */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="lg:hidden mx-auto mt-2 max-w-6xl overflow-hidden glass-bubble rounded-2xl"
          >
            <nav className="flex flex-col gap-1 p-3">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all",
                    view === item.id
                      ? "bg-gradient-to-br from-emerald-500/25 to-gold/15 text-foreground ring-1 ring-emerald-glow/40"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
              <DropdownMenuSeparator className="my-1 bg-white/10" />
              {admin ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => { go("orders"); }} className="justify-start gap-2 rounded-xl">
                    <ClipboardList className="h-4 w-4" /> My Orders
                  </Button>
                  {admin.role === "admin" && (
                    <Button variant="ghost" size="sm" onClick={() => { go("upload"); }} className="justify-start gap-2 rounded-xl">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={logout} className="justify-start gap-2 text-rose-400 rounded-xl">
                    <LogOut className="h-4 w-4" /> Log out ({admin.name.split(" ")[0]})
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => go("auth")} className="justify-start gap-2 rounded-xl">
                  <UserIcon className="h-4 w-4" /> Sign In / Sign Up
                </Button>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

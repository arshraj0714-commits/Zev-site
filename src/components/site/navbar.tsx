"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles, LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";
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
            {/* Account / Sign In */}
            {admin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-gold text-xs font-bold text-black">
                      {admin.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[90px] truncate sm:inline">
                      {admin.name.split(" ")[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass-strong">
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
                className="gap-2"
              >
                <UserIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}

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
              <DropdownMenuSeparator className="my-2 bg-border/40" />
              {admin ? (
                <>
                  {admin.role === "admin" && (
                    <Button variant="ghost" size="sm" onClick={() => { go("upload"); }} className="justify-start gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={logout} className="justify-start gap-2 text-rose-400">
                    <LogOut className="h-4 w-4" /> Log out ({admin.name.split(" ")[0]})
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => go("auth")} className="justify-start gap-2">
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

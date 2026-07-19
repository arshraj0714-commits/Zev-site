"use client";

import { create } from "zustand";

export type ViewId =
  | "home"
  | "products"
  | "opensource"
  | "stock"
  | "upload"
  | "about"
  | "auth";

interface CheckoutTarget {
  itemType: "product" | "stock";
  itemId: string;
  name: string;
  price: number;
  image?: string | null;
  description?: string;
}

export interface AdminUser {
  id?: string;
  email: string;
  name: string;
  role: string;
}

interface ZevStore {
  view: ViewId;
  setView: (v: ViewId) => void;
  go: (v: ViewId) => void;

  checkoutOpen: boolean;
  checkoutTarget: CheckoutTarget | null;
  openCheckout: (t: CheckoutTarget) => void;
  closeCheckout: () => void;

  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;

  // Auth
  admin: AdminUser | null;
  authToken: string | null;
  authLoading: boolean;
  setAuth: (user: AdminUser | null, token: string | null) => void;
  logout: () => void;
  hydrateAuth: () => void;
}

function getViewFromHash(): ViewId {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace("#/", "").replace("#", "");
  const valid: ViewId[] = ["home", "products", "opensource", "stock", "upload", "about", "auth"];
  return (valid.includes(h as ViewId) ? (h as ViewId) : "home");
}

const AUTH_STORAGE_KEY = "zev-auth";

export const useZev = create<ZevStore>((set, get) => ({
  view: "home",
  setView: (v) => set({ view: v }),
  go: (v) => {
    if (typeof window !== "undefined") {
      window.location.hash = `/${v}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    set({ view: v, mobileNavOpen: false });
  },

  checkoutOpen: false,
  checkoutTarget: null,
  openCheckout: (t) => set({ checkoutOpen: true, checkoutTarget: t }),
  closeCheckout: () => set({ checkoutOpen: false, checkoutTarget: null }),

  mobileNavOpen: false,
  setMobileNav: (open) => set({ mobileNavOpen: open }),

  admin: null,
  authToken: null,
  authLoading: true,
  setAuth: (user, token) => {
    if (typeof window !== "undefined") {
      if (user && token) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    set({ admin: user, authToken: token, authLoading: false });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    set({ admin: null, authToken: null });
  },
  hydrateAuth: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user && parsed?.token) {
          // Verify token with backend
          fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${parsed.token}` },
          })
            .then((r) => r.json())
            .then((data) => {
              if (data?.user) {
                set({ admin: data.user, authToken: parsed.token, authLoading: false });
              } else {
                localStorage.removeItem(AUTH_STORAGE_KEY);
                set({ admin: null, authToken: null, authLoading: false });
              }
            })
            .catch(() => set({ admin: null, authToken: null, authLoading: false }));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    set({ authLoading: false });
  },
}));

// Initialize view from hash + hydrate auth on client load
if (typeof window !== "undefined") {
  useZev.getState().setView(getViewFromHash());
  useZev.getState().hydrateAuth();
  window.addEventListener("hashchange", () => {
    useZev.getState().setView(getViewFromHash());
  });
}

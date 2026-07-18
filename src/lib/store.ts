"use client";

import { create } from "zustand";

export type ViewId =
  | "home"
  | "products"
  | "opensource"
  | "stock"
  | "upload"
  | "about";

interface CheckoutTarget {
  itemType: "product" | "stock";
  itemId: string;
  name: string;
  price: number;
  image?: string | null;
  description?: string;
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

  adminMode: boolean;
  toggleAdmin: () => void;
}

function getViewFromHash(): ViewId {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace("#/", "").replace("#", "");
  const valid: ViewId[] = ["home", "products", "opensource", "stock", "upload", "about"];
  return (valid.includes(h as ViewId) ? (h as ViewId) : "home");
}

export const useZev = create<ZevStore>((set, get) => ({
  view: typeof window !== "undefined" ? getViewFromHash() : "home",
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

  adminMode: false,
  toggleAdmin: () => set({ adminMode: !get().adminMode }),
}));

// Sync hash changes (back/forward)
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    useZev.getState().setView(getViewFromHash());
  });
}

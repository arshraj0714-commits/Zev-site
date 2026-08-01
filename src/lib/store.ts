"use client";

import { create } from "zustand";

export type ViewId =
  | "home"
  | "products"
  | "product-detail"
  | "opensource"
  | "stock"
  | "upload"
  | "about"
  | "auth"
  | "orders"
  | "settings"
  | "redeem"
  | "tos"
  | "reset-password";

interface CheckoutTarget {
  itemType: "product" | "stock";
  itemId: string;
  name: string;
  price: number;
  image?: string | null;
  description?: string;
}

// Cart item — only products can be added to cart (stock has limited quantity)
export interface CartItem {
  id: string;       // product ID
  name: string;
  price: number;
  image?: string | null;
  type: string;     // "paid" | "free"
}

export interface AdminUser {
  id?: string;
  email: string;
  name: string;
  role: string;
  tosAccepted?: boolean;
}

interface ZevStore {
  view: ViewId;
  setView: (v: ViewId) => void;
  go: (v: ViewId) => void;

  // Product detail — selected product ID for the detail view
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  goToProduct: (id: string) => void;

  // Global search — set from the navbar search bar, consumed once by ProductsView
  pendingSearchQuery: string | null;
  searchAndGo: (query: string) => void;
  clearPendingSearchQuery: () => void;

  checkoutOpen: boolean;
  checkoutTarget: CheckoutTarget | null;
  // Cart checkout — when checking out multiple items at once
  checkoutCart: CartItem[] | null;
  openCheckout: (t: CheckoutTarget) => void;
  openCartCheckout: (items: CartItem[]) => void;
  closeCheckout: () => void;

  // Cart drawer
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;

  // Cart state (persisted to localStorage)
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  cartCount: () => number;
  cartTotal: () => number;

  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;

  // Auth
  admin: AdminUser | null;
  authToken: string | null;
  authLoading: boolean;
  setAuth: (user: AdminUser | null, token: string | null) => void;
  logout: () => void;
  hydrateAuth: () => void;

  // Password reset token (extracted from #/reset-password?token=xxx links)
  resetToken: string | null;
  setResetToken: (t: string | null) => void;
}

function getViewFromHash(): ViewId {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace("#/", "").replace("#", "");
  // strip query string for view detection
  const viewPart = h.split("?")[0];

  // Handle nested route: products/{id} → product-detail view
  if (viewPart.startsWith("products/")) {
    return "product-detail";
  }

  const valid: ViewId[] = ["home", "products", "product-detail", "opensource", "stock", "upload", "about", "auth", "orders", "settings", "redeem", "tos", "reset-password"];
  return (valid.includes(viewPart as ViewId) ? (viewPart as ViewId) : "home");
}

function getProductIdFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace("#/", "").replace("#", "");
  const path = h.split("?")[0];
  if (path.startsWith("products/")) {
    const id = path.replace("products/", "");
    return id || null;
  }
  return null;
}

const AUTH_STORAGE_KEY = "zev-auth";
const CART_STORAGE_KEY = "zev-cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

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

  // Product detail navigation
  selectedProductId: null,
  setSelectedProductId: (id) => set({ selectedProductId: id }),
  goToProduct: (id) => {
    if (typeof window !== "undefined") {
      window.location.hash = `/products/${id}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    set({ view: "product-detail", selectedProductId: id, mobileNavOpen: false });
  },

  pendingSearchQuery: null,
  searchAndGo: (query) => {
    if (typeof window !== "undefined") {
      window.location.hash = "/products";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    set({ view: "products", mobileNavOpen: false, pendingSearchQuery: query });
  },
  clearPendingSearchQuery: () => set({ pendingSearchQuery: null }),

  checkoutOpen: false,
  checkoutTarget: null,
  checkoutCart: null,
  openCheckout: (t) => set({ checkoutOpen: true, checkoutTarget: t, checkoutCart: null }),
  openCartCheckout: (items) => set({ checkoutOpen: true, checkoutTarget: null, checkoutCart: items }),
  closeCheckout: () => set({ checkoutOpen: false, checkoutTarget: null, checkoutCart: null }),

  // Cart drawer
  cartOpen: false,
  setCartOpen: (open) => set({ cartOpen: open }),

  // Cart state
  cart: loadCart(),
  addToCart: (item) => {
    const cart = get().cart;
    // Don't add duplicates (same product ID)
    if (cart.some((i) => i.id === item.id)) {
      // Just open the cart to show it's already there
      set({ cartOpen: true });
      return;
    }
    const newCart = [...cart, item];
    saveCart(newCart);
    set({ cart: newCart, cartOpen: true });
  },
  removeFromCart: (id) => {
    const newCart = get().cart.filter((i) => i.id !== id);
    saveCart(newCart);
    set({ cart: newCart });
  },
  clearCart: () => {
    saveCart([]);
    set({ cart: [] });
  },
  cartCount: () => get().cart.length,
  cartTotal: () => get().cart.reduce((sum, i) => sum + i.price, 0),

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

    // Check for Google OAuth callback — token in URL hash
    try {
      const hash = window.location.hash;
      if (hash.includes("google_token=")) {
        const params = new URLSearchParams(hash.split("?")[1] || "");
        const token = params.get("google_token");
        const userStr = params.get("google_user");
        if (token && userStr) {
          const user = JSON.parse(decodeURIComponent(userStr));
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
          set({ admin: user, authToken: token, authLoading: false });
          // Clean the URL — remove the token params
          const cleanHash = hash.split("?")[0];
          window.history.replaceState(null, "", window.location.pathname + cleanHash);
          return;
        }
      }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user && parsed?.token) {
          // Verify token with backend
          fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${parsed.token}` },
          })
            .then(async (r) => {
              try { return await r.json(); } catch { return {}; }
            })
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

  resetToken: null,
  setResetToken: (t) => set({ resetToken: t }),
}));

// Initialize view from hash + hydrate auth on client load
if (typeof window !== "undefined") {
  // Detect reset-password link: #/reset-password?token=xxx
  const initReset = () => {
    const hash = window.location.hash;
    if (hash.includes("/reset-password")) {
      const params = new URLSearchParams(hash.split("?")[1] || "");
      const t = params.get("token");
      if (t) {
        useZev.getState().setResetToken(t);
      }
    }
  };

  // Detect product detail link: #/products/{id}
  const initProductDetail = () => {
    const id = getProductIdFromHash();
    if (id) {
      useZev.getState().setSelectedProductId(id);
    }
  };

  initReset();
  initProductDetail();
  useZev.getState().setView(getViewFromHash());
  useZev.getState().hydrateAuth();
  window.addEventListener("hashchange", () => {
    initReset();
    initProductDetail();
    useZev.getState().setView(getViewFromHash());
  });
}

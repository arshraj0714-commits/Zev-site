"use client";

import { useQuery } from "@tanstack/react-query";

export interface Product {
  id: string;
  name: string;
  description: string;
  image?: string | null;
  codeLink?: string | null;
  folder?: string | null;
  type: string;
  price: number;
  tags?: string | null;
  featured: boolean;
  salesCount: number;
  fileName?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

export interface StockItem {
  id: string;
  name: string;
  description: string;
  image?: string | null;
  category?: string | null;
  price: number;
  quantity: number;
  soldCount: number;
  tags?: string | null;
  createdAt: string;
}

export interface OpenSourceItem {
  id: string;
  name: string;
  description: string;
  image?: string | null;
  codeLink?: string | null;
  category?: string | null;
  tags?: string | null;
  stars: number;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  explorer: string;
  explorerTx: string;
  color: string;
  address: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      msg = data.error || data.message || msg;
    } catch {
      try {
        const text = await res.text();
        if (text && text.length < 200) msg = text;
      } catch {}
    }
    throw new Error(msg);
  }
  // Safely parse JSON — handle plain-text responses without crashing
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export function useProducts(type: "all" | "paid" | "free" = "all") {
  return useQuery({
    queryKey: ["products", type],
    queryFn: () => fetchJson<{ products: Product[] }>(`/api/products?type=${type}`),
  });
}

export function useStock() {
  return useQuery({
    queryKey: ["stock"],
    queryFn: () => fetchJson<{ items: StockItem[] }>(`/api/stock`),
  });
}

export function useOpenSource() {
  return useQuery({
    queryKey: ["opensource"],
    queryFn: () => fetchJson<{ items: OpenSourceItem[] }>(`/api/opensource`),
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => fetchJson<{ stats: { vouches: number; productsSold: number } }>(`/api/stats`),
  });
}

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: () =>
      fetchJson<{ prices: Record<string, number>; methods: PaymentMethod[] }>(`/api/prices`),
    refetchInterval: 60_000,
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchJson<{ orders: any[]; isAdmin?: boolean }>(`/api/orders`),
  });
}

export function useMyOrders(search?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  return useQuery({
    queryKey: ["my-orders", search || ""],
    queryFn: () => fetchJson<{ orders: any[]; isAdmin?: boolean }>(`/api/orders${params.toString() ? `?${params}` : ""}`),
  });
}

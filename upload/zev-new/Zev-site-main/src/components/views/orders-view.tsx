"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search, Package, Loader2, CheckCircle2, Clock, XCircle,
  Copy, Check, Coins, Mail, Download, ChevronDown, ChevronUp, ArrowLeft,
} from "lucide-react";
import { useZev } from "@/lib/store";
import { useMyOrders } from "@/hooks/use-data";
import { SectionHeading } from "@/components/site/section-heading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: string;
  orderNumber: string;
  itemType: string;
  itemName: string;
  amount: number;
  paymentMethod: string;
  cryptoAmount: number;
  txHash: string | null;
  buyerEmail: string | null;
  buyerDiscord: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge className="bg-emerald-500/90 text-emerald-950 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge className="bg-amber-500/90 text-amber-950 gap-1">
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  return (
    <Badge className="bg-rose-500/90 text-rose-950 gap-1">
      <XCircle className="h-3 w-3" /> Failed
    </Badge>
  );
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export function OrdersView() {
  const { go, admin } = useZev();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [detailContent, setDetailContent] = useState<Record<string, { content: string | null; file: any | null; loading: boolean }>>({});

  const { data, isLoading } = useMyOrders(search);

  const orders = data?.orders ?? [];
  const isAdmin = data?.isAdmin || admin?.role === "admin";

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  }

  async function toggleExpand(order: OrderRow) {
    const id = order.id;
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    // Load full detail (delivered content) if not already loaded
    if (!detailContent[id] && order.status === "paid") {
      setDetailContent((prev) => ({ ...prev, [id]: { content: null, file: null, loading: true } }));
      try {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        if (res.ok) {
          setDetailContent((prev) => ({
            ...prev,
            [id]: { content: data.order?.deliveredContent || null, file: data.file || null, loading: false },
          }));
        } else {
          setDetailContent((prev) => ({ ...prev, [id]: { content: null, file: null, loading: false } }));
        }
      } catch {
        setDetailContent((prev) => ({ ...prev, [id]: { content: null, file: null, loading: false } }));
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow={isAdmin ? "Admin · All Orders" : "My Orders"}
        title={isAdmin ? "All Orders" : "Your Purchase History"}
        subtitle={
          isAdmin
            ? "Search and manage all orders from every buyer."
            : "View your past purchases and re-download your products."
        }
      />

      {/* Search */}
      <div className="relative mt-8">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by order #, item name, email, or tx hash..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass pl-9"
        />
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="mt-12 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass ring-1 ring-border/40">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {search ? "No matching orders found" : "No orders yet"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? "Try a different search term."
              : "When you buy something, your orders will appear here."}
          </p>
          {!search && (
            <Button onClick={() => go("products")} className="mt-4 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
              Browse Marketplace
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {/* Count */}
          <p className="text-xs text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
            {isAdmin && " · showing all buyers"}
          </p>

          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="glass-bubble glass-bubble-hover overflow-hidden rounded-xl"
            >
              {/* Order header row */}
              <button
                onClick={() => toggleExpand(order)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                {/* Order number */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-bold text-emerald-glow">{order.orderNumber}</code>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium">{order.itemName}</div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(order.createdAt)}</span>
                    {isAdmin && order.buyerEmail && (
                      <span className="flex items-center gap-0.5">
                        <Mail className="h-3 w-3" /> {order.buyerEmail}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-bold text-gold">
                    {order.amount > 0 ? `$${order.amount.toFixed(2)}` : "FREE"}
                  </div>
                  {order.amount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {order.cryptoAmount.toFixed(6)} {order.paymentMethod}
                    </div>
                  )}
                </div>

                {/* Expand icon */}
                {order.status === "paid" && (
                  <div className="shrink-0 text-muted-foreground">
                    {expanded === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                )}
              </button>

              {/* Expanded detail */}
              {expanded === order.id && order.status === "paid" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-border/40 p-4"
                >
                  {detailContent[order.id]?.loading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-glow" />
                      <span className="text-sm text-muted-foreground">Loading details...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Delivered content */}
                      {detailContent[order.id]?.content && (
                        <div>
                          <div className="mb-1.5 text-xs font-medium text-emerald-glow">Delivered Content</div>
                          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-background/60 p-3 text-xs font-mono ring-1 ring-border/40">
                            {detailContent[order.id].content}
                          </pre>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 gap-1 text-xs"
                            onClick={() => copy(detailContent[order.id].content, "Content")}
                          >
                            {copied === "Content" ? <Check className="h-3 w-3 text-emerald-glow" /> : <Copy className="h-3 w-3" />}
                            Copy
                          </Button>
                        </div>
                      )}

                      {/* Download file */}
                      {detailContent[order.id]?.file && (
                        <div className="flex items-center gap-3 rounded-lg bg-accent/20 p-3 ring-1 ring-border/40">
                          <Download className="h-5 w-5 text-gold" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{detailContent[order.id].file.name}</div>
                            {detailContent[order.id].file.size && (
                              <div className="text-xs text-muted-foreground">
                                {(detailContent[order.id].file.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            asChild
                            className="gap-1 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950"
                          >
                            <a href={`/api/orders/${order.id}/download`} download>
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          </Button>
                        </div>
                      )}

                      {/* TX hash */}
                      {order.txHash && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Tx:</span>
                          <code className="truncate text-emerald-glow">{order.txHash}</code>
                          <button onClick={() => copy(order.txHash!, "TxHash")} className="shrink-0 text-muted-foreground hover:text-foreground">
                            {copied === "TxHash" ? <Check className="h-3 w-3 text-emerald-glow" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Back button */}
      <button onClick={() => go("home")} className="mt-8 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </button>
    </div>
  );
}

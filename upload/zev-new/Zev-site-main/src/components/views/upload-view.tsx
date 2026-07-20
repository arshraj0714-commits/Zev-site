"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Package, Boxes, Code2, X, Plus,
  CheckCircle2, Loader2, Trash2, ShieldCheck, Lock, LogOut, Pencil, FileArchive,
} from "lucide-react";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/site/image-upload";
import { ZipUpload, type ZipFileValue } from "@/components/site/zip-upload";
import { EditProductModal } from "@/components/site/edit-product-modal";
import { useZev } from "@/lib/store";
import { useProducts, useStock, useOpenSource, useOrders, type Product } from "@/hooks/use-data";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Access gate (redirects to auth / shows notice) ----------
function AccessGate({ reason }: { reason: "signed-out" | "not-admin" }) {
  const { go } = useZev();
  return (
    <div className="mx-auto mt-8 max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl glass-strong p-8 text-center ring-1 ring-border/40"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-emerald-500/20 ring-1 ring-border/50 animate-pulse-glow">
          <Lock className="h-8 w-8 text-gold" />
        </div>
        <h2 className="mt-4 text-2xl font-bold">
          {reason === "signed-out" ? "Admin Access" : "Admins Only"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {reason === "signed-out"
            ? "Sign in to your account to manage products, stock, and orders."
            : "This dashboard is restricted to admins. Your account doesn't have admin access."}
        </p>
        <Button
          onClick={() => go("auth")}
          className="mt-6 w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
        >
          <ShieldCheck className="h-4 w-4" /> Sign In / Sign Up
        </Button>
        <button
          onClick={() => go("home")}
          className="mt-3 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to home
        </button>
      </motion.div>
    </div>
  );
}

export function UploadView() {
  const { admin, authLoading, logout } = useZev();
  const qc = useQueryClient();

  // Product form
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImage, setPImage] = useState<string | null>(null);
  const [pLink, setPLink] = useState("");
  const [pFolder, setPFolder] = useState("");
  const [pType, setPType] = useState<"paid" | "free">("paid");
  const [pPrice, setPPrice] = useState("");
  const [pTags, setPTags] = useState("");
  const [pFeatured, setPFeatured] = useState(false);
  const [pFile, setPFile] = useState<ZipFileValue | null>(null);
  const [savingP, setSavingP] = useState(false);

  // Stock form
  const [sName, setSName] = useState("");
  const [sDesc, setSDesc] = useState("");
  const [sImage, setSImage] = useState<string | null>(null);
  const [sCategory, setSCategory] = useState("Email");
  const [sPrice, setSPrice] = useState("");
  const [sQty, setSQty] = useState("1");
  const [sTags, setSTags] = useState("");
  const [creds, setCreds] = useState<{ label: string; value: string }[]>([
    { label: "", value: "" },
  ]);
  const [savingS, setSavingS] = useState(false);

  // Open source form
  const [oName, setOName] = useState("");
  const [oDesc, setODesc] = useState("");
  const [oImage, setOImage] = useState<string | null>(null);
  const [oLink, setOLink] = useState("");
  const [oCategory, setOCategory] = useState("Discord Bot");
  const [oTags, setOTags] = useState("");
  const [savingO, setSavingO] = useState(false);

  const { data: productsData } = useProducts();
  const { data: stockData } = useStock();
  const { data: osData } = useOpenSource();
  const { data: ordersData } = useOrders();

  // Edit modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  async function saveProduct() {
    if (!pName || !pDesc) { toast.error("Name and description required"); return; }
    setSavingP(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pName, description: pDesc, image: pImage, codeLink: pLink,
          folder: pFolder, type: pType, price: pType === "free" ? 0 : Number(pPrice) || 0,
          tags: pTags, featured: pFeatured,
          fileName: pFile?.name ?? null, fileData: pFile?.data ?? null, fileSize: pFile?.size ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      toast.success("Product added successfully!");
      setPName(""); setPDesc(""); setPImage(null); setPLink(""); setPFolder("");
      setPPrice(""); setPTags(""); setPFeatured(false); setPFile(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) { toast.error((e as Error).message || "Failed to add product"); }
    finally { setSavingP(false); }
  }

  async function saveStock() {
    if (!sName || !sDesc) { toast.error("Name and description required"); return; }
    const validCreds = creds.filter((c) => c.label || c.value);
    if (validCreds.length === 0) { toast.error("Add at least one credential"); return; }
    setSavingS(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sName, description: sDesc, image: sImage, category: sCategory,
          price: Number(sPrice) || 0, quantity: Number(sQty) || 1,
          credentials: validCreds, tags: sTags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      toast.success("Stock item added!");
      setSName(""); setSDesc(""); setSImage(null); setSPrice(""); setSQty("1");
      setSTags(""); setCreds([{ label: "", value: "" }]);
      qc.invalidateQueries({ queryKey: ["stock"] });
    } catch (e) { toast.error((e as Error).message || "Failed to add stock"); }
    finally { setSavingS(false); }
  }

  async function saveOS() {
    if (!oName || !oDesc) { toast.error("Name and description required"); return; }
    setSavingO(true);
    try {
      const res = await fetch("/api/opensource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: oName, description: oDesc, image: oImage, codeLink: oLink,
          category: oCategory, tags: oTags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      toast.success("Open source code added!");
      setOName(""); setODesc(""); setOImage(null); setOLink(""); setOTags("");
      qc.invalidateQueries({ queryKey: ["opensource"] });
    } catch (e) { toast.error((e as Error).message || "Failed to add open source code"); }
    finally { setSavingO(false); }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["products"] }); }
  }
  async function deleteStock(id: string) {
    if (!confirm("Delete this stock item?")) return;
    const res = await fetch(`/api/stock/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["stock"] }); }
  }
  async function deleteOS(id: string) {
    if (!confirm("Delete this open source code?")) return;
    const res = await fetch(`/api/opensource/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["opensource"] }); }
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Not logged in → show login
  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Dashboard"
          title="Upload & Manage"
          subtitle="Sign in to manage products, stock, and orders."
        />
        <AccessGate reason="signed-out" />
      </div>
    );
  }

  // Non-admin users can't access the dashboard
  if (admin.role !== "admin") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Dashboard"
          title="Upload & Manage"
          subtitle="This area is restricted to administrators."
        />
        <AccessGate reason="not-admin" />
      </div>
    );
  }

  // Logged in → show admin panel
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Admin header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold" />
            <h2 className="text-2xl font-bold">Welcome, {admin.name.split(" ")[0]}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{admin.role} · {admin.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="glass gap-2">
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>

      <Tabs defaultValue="product" className="mt-2">
        <TabsList className="grid w-full grid-cols-3 glass">
          <TabsTrigger value="product" className="gap-2"><Package className="h-4 w-4" /> Product</TabsTrigger>
          <TabsTrigger value="stock" className="gap-2"><Boxes className="h-4 w-4" /> Stock</TabsTrigger>
          <TabsTrigger value="opensource" className="gap-2"><Code2 className="h-4 w-4" /> Open Source</TabsTrigger>
        </TabsList>

        {/* PRODUCT FORM */}
        <TabsContent value="product" className="mt-6 space-y-6">
          <div className="grid gap-5 rounded-2xl glass p-6 ring-1 ring-border/40 md:grid-cols-2">
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={pName} onChange={(e)=>setPName(e.target.value)} className="glass" placeholder="e.g. Nitro Sniper Bot" /></div>
              <div><Label>Description *</Label><Textarea value={pDesc} onChange={(e)=>setPDesc(e.target.value)} className="glass" rows={3} placeholder="What does it do?" /></div>
              <div><Label>Code Link</Label><Input value={pLink} onChange={(e)=>setPLink(e.target.value)} className="glass" placeholder="https://github.com/..." /></div>
              <div><Label>Folder / Category</Label><Input value={pFolder} onChange={(e)=>setPFolder(e.target.value)} className="glass" placeholder="e.g. Discord Bots" /></div>
              <div><Label>Tags (comma separated)</Label><Input value={pTags} onChange={(e)=>setPTags(e.target.value)} className="glass" placeholder="discord, bot, sniper" /></div>
            </div>
            <div className="space-y-4">
              <ImageUpload value={pImage} onChange={setPImage} label="Product Image" />
              <ZipUpload
                fileName={pFile?.name}
                fileSize={pFile?.size}
                onChange={(f) => setPFile(f)}
              />
              <div>
                <Label>Type</Label>
                <div className="mt-2 flex gap-2">
                  {(["paid","free"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPType(t)}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize ring-1 transition-colors",
                        pType === t
                          ? t === "paid" ? "bg-gold/90 text-black ring-gold" : "bg-emerald-500/90 text-emerald-950 ring-emerald-500"
                          : "glass ring-border/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t === "paid" ? "Paid" : "Free"}
                    </button>
                  ))}
                </div>
              </div>
              {pType === "paid" && (
                <div><Label>Price (USD)</Label><Input type="number" value={pPrice} onChange={(e)=>setPPrice(e.target.value)} className="glass" placeholder="25.00" /></div>
              )}
              <div className="flex items-center justify-between rounded-lg glass px-4 py-3 ring-1 ring-border/40">
                <div><div className="text-sm font-medium">Featured</div><div className="text-xs text-muted-foreground">Show on homepage</div></div>
                <Switch checked={pFeatured} onCheckedChange={setPFeatured} />
              </div>
              <Button onClick={saveProduct} disabled={savingP} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
                {savingP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Product
              </Button>
            </div>
          </div>

          <div className="rounded-2xl glass p-5 ring-1 ring-border/40">
            <h4 className="mb-3 font-semibold">Existing Products ({productsData?.products.length ?? 0})</h4>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {(productsData?.products ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEditingProduct(p)}
                  className="group flex w-full items-center justify-between gap-2 rounded-lg bg-accent/20 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40 hover:ring-1 hover:ring-gold/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={p.type === "paid" ? "default" : "secondary"} className={p.type === "paid" ? "bg-gold/80 text-black" : "bg-emerald-500/80 text-emerald-950"}>{p.type}</Badge>
                    <span className="truncate font-medium">{p.name}</span>
                    {p.featured && <Badge variant="outline" className="text-gold">★</Badge>}
                    {p.fileName && (
                      <span title={p.fileName} className="inline-flex items-center gap-1 text-emerald-glow">
                        <FileArchive className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{p.price > 0 ? `$${p.price}` : "FREE"}</span>
                    <span className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); deleteProduct(p.id); } }}
                      className="text-muted-foreground hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* STOCK FORM */}
        <TabsContent value="stock" className="mt-6 space-y-6">
          <div className="grid gap-5 rounded-2xl glass p-6 ring-1 ring-border/40 md:grid-cols-2">
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={sName} onChange={(e)=>setSName(e.target.value)} className="glass" placeholder="e.g. Premium Email (5 pack)" /></div>
              <div><Label>Description *</Label><Textarea value={sDesc} onChange={(e)=>setSDesc(e.target.value)} className="glass" rows={3} placeholder="What's included?" /></div>
              <div><Label>Category</Label>
                <Input value={sCategory} onChange={(e)=>setSCategory(e.target.value)} className="glass" placeholder="Email / Account / Credential" list="stock-cats" />
                <datalist id="stock-cats"><option value="Email" /><option value="Account" /><option value="Credential" /></datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (USD)</Label><Input type="number" value={sPrice} onChange={(e)=>setSPrice(e.target.value)} className="glass" placeholder="8.00" /></div>
                <div><Label>Quantity</Label><Input type="number" value={sQty} onChange={(e)=>setSQty(e.target.value)} className="glass" placeholder="10" /></div>
              </div>
              <div><Label>Tags (comma separated)</Label><Input value={sTags} onChange={(e)=>setSTags(e.target.value)} className="glass" placeholder="email, verified" /></div>
            </div>
            <div className="space-y-4">
              <ImageUpload value={sImage} onChange={setSImage} label="Stock Image" />
              <div>
                <div className="flex items-center justify-between">
                  <Label>Credentials (revealed after purchase)</Label>
                  <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setCreds([...creds, { label: "", value: "" }])}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {creds.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={c.label} onChange={(e)=>{const n=[...creds];n[i]={...n[i],label:e.target.value};setCreds(n);}} className="glass text-sm" placeholder="Label (e.g. Email)" />
                      <Input value={c.value} onChange={(e)=>{const n=[...creds];n[i]={...n[i],value:e.target.value};setCreds(n);}} className="glass text-sm" placeholder="user@x.com : pass" />
                      {creds.length > 1 && (
                        <button onClick={() => setCreds(creds.filter((_,x)=>x!==i))} className="text-muted-foreground hover:text-rose-400 px-1"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">These are stored securely and only shown to buyers after payment confirms.</p>
              </div>
              <Button onClick={saveStock} disabled={savingS} className="w-full gap-2 bg-gradient-to-r from-gold to-amber-400 text-black">
                {savingS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Stock Item
              </Button>
            </div>
          </div>

          <div className="rounded-2xl glass p-5 ring-1 ring-border/40">
            <h4 className="mb-3 font-semibold">Existing Stock ({stockData?.items.length ?? 0})</h4>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {(stockData?.items ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-accent/20 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="glass">{s.category}</Badge>
                    <span className="truncate font-medium">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">${s.price} · {s.quantity - s.soldCount} left</span>
                    <button onClick={() => deleteStock(s.id)} className="text-muted-foreground hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* OPEN SOURCE FORM */}
        <TabsContent value="opensource" className="mt-6 space-y-6">
          <div className="grid gap-5 rounded-2xl glass p-6 ring-1 ring-border/40 md:grid-cols-2">
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={oName} onChange={(e)=>setOName(e.target.value)} className="glass" placeholder="e.g. Discord.js Bot Template" /></div>
              <div><Label>Description *</Label><Textarea value={oDesc} onChange={(e)=>setODesc(e.target.value)} className="glass" rows={3} placeholder="What does it do?" /></div>
              <div><Label>Code / Repo Link</Label><Input value={oLink} onChange={(e)=>setOLink(e.target.value)} className="glass" placeholder="https://github.com/..." /></div>
              <div><Label>Category</Label>
                <Input value={oCategory} onChange={(e)=>setOCategory(e.target.value)} className="glass" list="os-cats" />
                <datalist id="os-cats"><option value="Discord Bot" /><option value="Tool" /><option value="Script" /></datalist>
              </div>
              <div><Label>Tags (comma separated)</Label><Input value={oTags} onChange={(e)=>setOTags(e.target.value)} className="glass" placeholder="discord.js, free, template" /></div>
            </div>
            <div className="space-y-4">
              <ImageUpload value={oImage} onChange={setOImage} label="Preview Image" />
              <div className="rounded-lg bg-emerald-500/10 p-4 ring-1 ring-emerald-glow/20">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-glow">
                  <CheckCircle2 className="h-4 w-4" /> Always Free
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Open source codes are free for everyone — no payment required.</p>
              </div>
              <Button onClick={saveOS} disabled={savingO} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
                {savingO ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Open Source Code
              </Button>
            </div>
          </div>

          <div className="rounded-2xl glass p-5 ring-1 ring-border/40">
            <h4 className="mb-3 font-semibold">Existing Open Source ({osData?.items.length ?? 0})</h4>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {(osData?.items ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-accent/20 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="glass">{o.category}</Badge>
                    <span className="truncate font-medium">{o.name}</span>
                  </div>
                  <button onClick={() => deleteOS(o.id)} className="text-muted-foreground hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Orders overview */}
      <div className="mt-8 rounded-2xl glass p-5 ring-1 ring-border/40">
        <h4 className="mb-3 font-semibold">Recent Orders ({ordersData?.orders.length ?? 0})</h4>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {(ordersData?.orders ?? []).slice(0, 20).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-accent/20 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant={o.status === "paid" ? "default" : "secondary"} className={o.status === "paid" ? "bg-emerald-500/80 text-emerald-950" : "glass"}>{o.status}</Badge>
                <span className="truncate font-medium">{o.itemName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{o.paymentMethod}</span>
                <span>${o.amount}</span>
              </div>
            </div>
          ))}
          {(ordersData?.orders.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        </div>
      </div>

      <EditProductModal
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(o) => { if (!o) setEditingProduct(null); }}
      />
    </div>
  );
}

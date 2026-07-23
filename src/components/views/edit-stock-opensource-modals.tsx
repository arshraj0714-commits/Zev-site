"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Save, Pencil, Upload, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/views/image-upload";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { StockItem, OpenSourceItem } from "@/hooks/use-data";

// ============= EDIT STOCK MODAL =============
export function EditStockModal({
  item,
  open,
  onOpenChange,
}: {
  item: StockItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [tags, setTags] = useState("");
  const [creds, setCreds] = useState<{ label: string; value: string }[]>([{ label: "", value: "" }]);
  const [saving, setSaving] = useState(false);

  // Sync form fields whenever a new stock item is opened for editing
  useEffect(() => {
    if (item) {
      setName(item.name ?? "");
      setDescription(item.description ?? "");
      setImage(item.image ?? null);
      setCategory(item.category ?? "");
      setPrice(item.price ? String(item.price) : "");
      setQuantity(String(item.quantity ?? 1));
      setTags(item.tags ?? "");
      // Fetch full detail (including credentials) from the detail endpoint
      fetch(`/api/stock/${item.id}`)
        .then(async (r) => { try { return await r.json(); } catch { return {}; } })
        .then((data) => {
          const credsRaw = data?.item?.credentials;
          try {
            const parsed = JSON.parse(credsRaw || "[]");
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCreds(parsed);
            } else {
              setCreds([{ label: "", value: "" }]);
            }
          } catch {
            setCreds([{ label: "", value: "" }]);
          }
        })
        .catch(() => setCreds([{ label: "", value: "" }]));
    }
  }, [item]);

  // Handle .txt file upload — parse credentials separated by newlines or commas
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      // Split by newlines first, then by commas
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const parsed: { label: string; value: string }[] = [];
      for (const line of lines) {
        // If a line contains commas, split it further
        const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          parsed.push({ label: `Item ${parsed.length + 1}`, value: part });
        }
      }
      if (parsed.length > 0) {
        setCreds(parsed);
        toast.success(`Loaded ${parsed.length} credentials from file`);
      } else {
        toast.error("No credentials found in file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleSave() {
    if (!item) return;
    if (!name || !description) { toast.error("Name and description required"); return; }
    setSaving(true);
    try {
      const validCreds = creds.filter((c) => c.label || c.value);
      const res = await fetch(`/api/stock/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, image, category,
          price: Number(price) || 0,
          quantity: Number(quantity) || 1,
          credentials: validCreds,
          tags,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Stock item updated!");
      qc.invalidateQueries({ queryKey: ["stock"] });
      onOpenChange(false);
    } catch {
      toast.error("Failed to update stock item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto border-border/40 bg-background/95 p-0 backdrop-blur-xl sm:max-w-2xl">
        <AnimatePresence>
          {item && (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-gold/10 to-transparent" />
              <DialogHeader className="relative space-y-1 p-6 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-amber-400/10 ring-1 ring-gold/30">
                    <Pencil className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">Edit Stock Item</DialogTitle>
                    <DialogDescription className="text-xs">Update details for &ldquo;{item.name}&rdquo;</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-5 p-6 pt-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-1.5"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="glass" /></div>
                  <div className="space-y-1.5"><Label>Description *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="glass" rows={3} /></div>
                  <div className="space-y-1.5"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="glass" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Price (USD)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="glass" /></div>
                    <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="glass" /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Tags</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} className="glass" /></div>
                </div>

                <div className="space-y-4">
                  <ImageUpload value={image} onChange={setImage} label="Stock Image" />
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Credentials</Label>
                      <div className="flex gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-emerald-glow hover:underline">
                          <Upload className="h-3 w-3" /> Upload .txt
                          <input type="file" accept=".txt,text/plain" onChange={handleFileUpload} className="hidden" />
                        </label>
                        <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setCreds([...creds, { label: "", value: "" }])}>
                          + Add
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {creds.map((c, i) => (
                        <div key={i} className="flex gap-2">
                          <Input value={c.label} onChange={(e) => { const n = [...creds]; n[i] = { ...n[i], label: e.target.value }; setCreds(n); }} className="glass text-sm" placeholder="Label" />
                          <Input value={c.value} onChange={(e) => { const n = [...creds]; n[i] = { ...n[i], value: e.target.value }; setCreds(n); }} className="glass text-sm" placeholder="value" />
                          {creds.length > 1 && (
                            <button onClick={() => setCreds(creds.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-rose-400 px-1">✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <FileText className="h-3 w-3" /> Upload a .txt file — each line or comma-separated value becomes a credential.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/40 bg-background/40 p-4">
                <Button variant="outline" className="glass" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold shadow-lg shadow-gold/20">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ============= EDIT OPENSOURCE MODAL =============
export function EditOpenSourceModal({
  item,
  open,
  onOpenChange,
}: {
  item: OpenSourceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [codeLink, setCodeLink] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name ?? "");
      setDescription(item.description ?? "");
      setImage(item.image ?? null);
      setCodeLink(item.codeLink ?? "");
      setCategory(item.category ?? "");
      setTags(item.tags ?? "");
    }
  }, [item]);

  async function handleSave() {
    if (!item) return;
    if (!name || !description) { toast.error("Name and description required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/opensource/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, image, codeLink, category, tags }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Open source code updated!");
      qc.invalidateQueries({ queryKey: ["opensource"] });
      onOpenChange(false);
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto border-border/40 bg-background/95 p-0 backdrop-blur-xl sm:max-w-2xl">
        <AnimatePresence>
          {item && (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-500/10 to-transparent" />
              <DialogHeader className="relative space-y-1 p-6 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-400/10 ring-1 ring-emerald-glow/30">
                    <Pencil className="h-4 w-4 text-emerald-glow" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">Edit Open Source Code</DialogTitle>
                    <DialogDescription className="text-xs">Update details for &ldquo;{item.name}&rdquo;</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-5 p-6 pt-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-1.5"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="glass" /></div>
                  <div className="space-y-1.5"><Label>Description *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="glass" rows={4} /></div>
                  <div className="space-y-1.5"><Label>Code / Repo Link</Label><Input value={codeLink} onChange={(e) => setCodeLink(e.target.value)} className="glass" placeholder="https://github.com/..." /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="glass" /></div>
                    <div className="space-y-1.5"><Label>Tags</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} className="glass" /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <ImageUpload value={image} onChange={setImage} label="Preview Image" />
                  <div className="rounded-lg bg-emerald-500/10 p-4 ring-1 ring-emerald-glow/20">
                    <p className="text-xs text-muted-foreground">Open source codes are free for everyone. The code link is visible to all visitors.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/40 bg-background/40 p-4">
                <Button variant="outline" className="glass" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-lg shadow-emerald-500/20">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Save, Coins, Sparkles, Pencil } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/views/image-upload";
import { ZipUpload, type ZipFileValue } from "@/components/views/zip-upload";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/use-data";

export function EditProductModal({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [codeLink, setCodeLink] = useState("");
  const [folder, setFolder] = useState("");
  const [type, setType] = useState<"paid" | "free">("paid");
  const [price, setPrice] = useState("");
  const [tags, setTags] = useState("");
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  // File attachment — mirrors current product metadata until the admin
  // actually picks a new file or removes it (fileTouched), so saving other
  // fields never accidentally wipes an existing attachment.
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [newFile, setNewFile] = useState<ZipFileValue | null>(null);
  const [fileTouched, setFileTouched] = useState(false);

  // Sync form fields whenever a new product is opened for editing
  useEffect(() => {
    if (product) {
      setName(product.name ?? "");
      setDescription(product.description ?? "");
      setImage(product.image ?? null);
      setCodeLink(product.codeLink ?? "");
      setFolder(product.folder ?? "");
      setType(product.type === "free" ? "free" : "paid");
      setPrice(product.price ? String(product.price) : "");
      setTags(product.tags ?? "");
      setFeatured(!!product.featured);
      setFileName(product.fileName ?? null);
      setFileSize(product.fileSize ?? null);
      setNewFile(null);
      setFileTouched(false);
    }
  }, [product]);

  async function handleSave() {
    if (!product) return;
    if (!name || !description) {
      toast.error("Name and description required");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        description,
        image,
        codeLink,
        folder,
        type,
        price: type === "free" ? 0 : Number(price) || 0,
        tags,
        featured,
      };
      if (fileTouched) {
        body.fileName = newFile?.name ?? null;
        body.fileData = newFile?.data ?? null;
        body.fileSize = newFile?.size ?? null;
      }
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Product updated!");
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    } catch {
      toast.error("Failed to update product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto border-border/40 bg-background/95 p-0 backdrop-blur-xl sm:max-w-2xl">
        <AnimatePresence>
          {product && (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="relative"
            >
              {/* Header glow */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-gold/10 to-transparent" />

              <DialogHeader className="relative space-y-1 p-6 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-amber-400/10 ring-1 ring-gold/30">
                    <Pencil className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">Edit Product</DialogTitle>
                    <DialogDescription className="text-xs">
                      Update details for &ldquo;{product.name}&rdquo;
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-5 p-6 pt-4 md:grid-cols-2">
                {/* Left column */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Name *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="glass" placeholder="e.g. Nitro Sniper Bot" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description *</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="glass" rows={4} placeholder="What does it do?" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Code Link</Label>
                    <Input value={codeLink} onChange={(e) => setCodeLink(e.target.value)} className="glass" placeholder="https://github.com/..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Folder / Category</Label>
                      <Input value={folder} onChange={(e) => setFolder(e.target.value)} className="glass" placeholder="Discord Bots" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tags</Label>
                      <Input value={tags} onChange={(e) => setTags(e.target.value)} className="glass" placeholder="discord, bot" />
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  <ImageUpload value={image} onChange={setImage} label="Product Image" />

                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <div className="flex gap-2">
                      {(["paid", "free"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold capitalize ring-1 transition-colors",
                            type === t
                              ? t === "paid"
                                ? "bg-gold/90 text-black ring-gold"
                                : "bg-emerald-500/90 text-emerald-950 ring-emerald-500"
                              : "glass ring-border/40 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {t === "paid" ? <Coins className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {t === "paid" ? "Paid" : "Free"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {type === "paid" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5 overflow-hidden"
                      >
                        <Label>Price (USD)</Label>
                        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="glass" placeholder="25.00" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between rounded-lg glass px-4 py-3 ring-1 ring-border/40">
                    <div>
                      <div className="text-sm font-medium">Featured</div>
                      <div className="text-xs text-muted-foreground">Show on homepage</div>
                    </div>
                    <Switch checked={featured} onCheckedChange={setFeatured} />
                  </div>

                  <ZipUpload
                    fileName={fileTouched ? newFile?.name : fileName}
                    fileSize={fileTouched ? newFile?.size : fileSize}
                    onChange={(f) => {
                      setFileTouched(true);
                      setNewFile(f);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/40 bg-background/40 p-4">
                <Button variant="outline" className="glass" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2 bg-gradient-to-r from-gold to-amber-400 text-black hover:from-amber-400 hover:to-gold shadow-lg shadow-gold/20"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

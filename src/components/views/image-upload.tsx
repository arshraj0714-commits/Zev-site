"use client";

import { useRef, useState } from "react";
import { Upload, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Maximum original file size before compression (5MB — we'll compress it down)
const MAX_RAW_SIZE = 5 * 1024 * 1024;
// Target maximum dimension for the compressed image
const MAX_DIMENSION = 800;
// JPEG quality for compression (0-1)
const JPEG_QUALITY = 0.85;

/**
 * Compresses and resizes an image file using canvas.
 * - Resizes to max 800px on the longest side
 * - Converts to JPEG at 85% quality
 * - A 2MB PNG becomes ~50-100KB
 * This is critical because Vercel's serverless function body limit is 4.5MB,
 * and base64 encoding adds ~33% overhead on top of the file size.
 */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions (maintain aspect ratio)
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        // Draw to canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG data URL
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({
  value, onChange, label = "Image",
}: { value?: string | null; onChange: (v: string | null) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_RAW_SIZE) {
      toast.error("Image too large (max 5MB). Use a smaller image or paste a URL.");
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const compressedSize = Math.round((compressed.length * 3) / 4); // base64 → bytes
      onChange(compressed);
      if (compressedSize < file.size) {
        toast.success(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB`);
      }
    } catch {
      toast.error("Failed to process image. Try a different file or paste a URL.");
    } finally {
      setBusy(false);
      // allow re-selecting the same file later
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl glass ring-1 ring-border/40">
          {value ? (
            <img src={value} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          {value && (
            <button
              onClick={() => onChange(null)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 hover:bg-background"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <Button type="button" variant="outline" size="sm" className="glass gap-2" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload Image
          </Button>
          <Input
            placeholder="or paste image URL"
            value={value && value.startsWith("http") ? value : ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="glass text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Max 5MB. Images are auto-compressed to ≤800px JPEG.</p>
        </div>
      </div>
    </div>
  );
}

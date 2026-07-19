"use client";

import { useRef, useState } from "react";
import { FileArchive, Upload, X, Loader2, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ZipFileValue {
  name: string;
  data: string; // base64 data URL
  size: number;
}

export function ZipUpload({
  fileName,
  fileSize,
  onChange,
  label = "Attached File (.zip)",
}: {
  fileName?: string | null;
  fileSize?: number | null;
  onChange: (file: ZipFileValue | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Please upload a .zip file");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File too large (max 100MB)");
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ name: file.name, data: reader.result as string, size: file.size });
      setBusy(false);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setBusy(false);
    };
    reader.readAsDataURL(file);
    // allow re-selecting the same file later
    e.target.value = "";
  }

  const hasFile = !!fileName;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={handleFile}
        className="hidden"
      />
      {hasFile ? (
        <div className="flex items-center gap-3 rounded-xl glass px-3 py-2.5 ring-1 ring-emerald-glow/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-glow/30">
            <FileCheck2 className="h-4 w-4 text-emerald-glow" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">{formatSize(fileSize)} · buyers can download after purchase</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-background/60 hover:text-rose-400"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 bg-accent/10 px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:bg-accent/20 hover:text-foreground"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Reading file...
            </>
          ) : (
            <>
              <FileArchive className="h-4 w-4" /> Click to upload .zip
              <Upload className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
      <p className="text-[11px] text-muted-foreground">Optional. Max 100MB. Buyers get a direct download button once their purchase is confirmed.</p>
    </div>
  );
}

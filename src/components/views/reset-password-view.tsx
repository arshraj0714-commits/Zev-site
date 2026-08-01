"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useZev } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZevLogo } from "@/components/site/logo";
import { toast } from "sonner";

type State = "form" | "success" | "error";

export function ResetPasswordView() {
  const { resetToken, setResetToken, go } = useZev();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<State>("form");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetToken) {
      toast.error("Invalid reset link. Please request a new one.");
      setState("error");
      return;
    }
    if (!newPassword) { toast.error("Please enter a new password"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }
      // Success — clear token, show success state
      setResetToken(null);
      setState("success");
      toast.success("Password changed! You can now sign in.");
    } catch (e) {
      setState("error");
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ---- ERROR STATE: invalid/expired/used link ----
  if (state === "error" || !resetToken) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <div className="flex flex-col items-center text-center">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
              <ZevLogo className="h-14 w-14" />
            </motion.div>
            <h1 className="mt-4 text-3xl font-bold"><span className="text-gradient-mixed">Invalid Link</span></h1>
            <p className="mt-1 text-sm text-muted-foreground">This password reset link is invalid, expired, or already used.</p>
          </div>
          <div className="mt-8 rounded-3xl glass-strong p-8 ring-1 ring-border/40">
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/30">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Reset links are single-use and expire after 10 minutes for security. Please request a new one.
              </p>
            </div>
            <Button onClick={() => go("auth")} className="mt-6 w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300">
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---- SUCCESS STATE: password changed, go sign in ----
  if (state === "success") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <div className="flex flex-col items-center text-center">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
              <ZevLogo className="h-14 w-14" />
            </motion.div>
            <h1 className="mt-4 text-3xl font-bold"><span className="text-gradient-mixed">Password Changed</span></h1>
            <p className="mt-1 text-sm text-muted-foreground">Your password has been updated successfully.</p>
          </div>
          <div className="mt-8 rounded-3xl glass-strong p-8 ring-1 ring-border/40">
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-glow/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-glow" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                You can now sign in with your email and new password. Head to the sign-up / sign-in page to continue.
              </p>
            </div>
            <Button onClick={() => go("auth")} className="mt-6 w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300">
              Continue to Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---- FORM STATE: enter new password ----
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.8, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
            <ZevLogo className="h-14 w-14" />
          </motion.div>
          <h1 className="mt-4 text-3xl font-bold"><span className="text-gradient-mixed">Reset Password</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account</p>
        </div>

        <div className="mt-8 rounded-3xl glass-strong p-6 ring-1 ring-border/40 sm:p-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col items-center text-center py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-gold/20 ring-1 ring-emerald-glow/30">
                <Lock className="h-7 w-7 text-emerald-glow" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Enter your new password below. Make it at least 6 characters.
              </p>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
              <div>
                <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="glass"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="glass"
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Passwords do not match
                </p>
              )}
              <Button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? "Changing..." : "Change Password"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => go("auth")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
                <span className="text-muted-foreground">Links expire in 10 minutes</span>
              </div>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

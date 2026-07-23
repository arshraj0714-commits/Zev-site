"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon, Mail, Lock, Loader2, Save, ShieldCheck, KeyRound, ArrowLeft,
} from "lucide-react";
import { useZev } from "@/lib/store";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function SettingsView() {
  const { admin, go, setAuth, logout } = useZev();
  const [name, setName] = useState(admin?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSavingProfile(true);
    try {
      const token = useZev.getState().authToken;
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.user) setAuth(data.user, token);
      toast.success(data.message || "Profile updated!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPass || !newPass || !confirmPass) {
      toast.error("Fill in all password fields");
      return;
    }
    if (newPass !== confirmPass) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPass.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setSavingPass(true);
    try {
      const token = useZev.getState().authToken;
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(data.message || "Password changed!");
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingPass(false);
    }
  }

  if (!admin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground">Please sign in to access settings.</p>
        <Button onClick={() => go("auth")} className="mt-4">Sign In</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Account" title="Settings" subtitle="Manage your profile and security." />

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-2xl glass-bubble glass-bubble-hover p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-emerald-glow" />
          <h3 className="text-lg font-bold">Profile</h3>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" /> Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="glass mt-1" placeholder="Your name" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email (cannot be changed)</Label>
            <Input value={admin.email} disabled className="glass mt-1 opacity-60" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={admin.role === "admin" ? "border-gold/40 text-gold" : ""}>
              {admin.role === "admin" ? "Admin" : "User"}
            </Badge>
          </div>
          <Button type="submit" disabled={savingProfile} className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950">
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </Button>
        </form>
      </motion.div>

      {/* Password card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl glass-bubble glass-bubble-hover p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-gold" />
          <h3 className="text-lg font-bold">Change Password</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Current Password</Label>
            <Input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} className="glass mt-1" placeholder="••••••••" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> New Password</Label>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="glass mt-1" placeholder="At least 6 characters" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Confirm New Password</Label>
            <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="glass mt-1" placeholder="Repeat new password" />
          </div>
          <Button type="submit" disabled={savingPass} className="gap-2 bg-gradient-to-r from-gold to-amber-400 text-black">
            {savingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Change Password
          </Button>
        </form>
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6"
      >
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-rose-400" />
          <h3 className="text-lg font-bold text-rose-300">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Sign out of your account on this device.</p>
        <Button variant="outline" onClick={logout} className="gap-2 border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
          Sign Out
        </Button>
      </motion.div>

      <button onClick={() => go("home")} className="mt-8 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </button>
    </div>
  );
}

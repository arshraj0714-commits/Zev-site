"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail, Lock, User as UserIcon, Loader2, ShieldCheck,
  Sparkles, ArrowRight, CheckCircle2,
} from "lucide-react";
import { useZev } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ZevLogo } from "@/components/site/logo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Inline brand icons (no extra deps)
function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
function AppleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.24 2.57-1.81 3.14-.46 7.78 1.29 10.33.85 1.25 1.86 2.65 3.18 2.6 1.28-.05 1.76-.83 3.31-.83 1.55 0 1.98.83 3.33.8 1.38-.03 2.25-1.27 3.09-2.53.97-1.45 1.37-2.85 1.39-2.92-.03-.01-2.67-1.02-2.7-4.05zM14.66 4.59c.7-.85 1.17-2.02 1.04-3.2-1.01.04-2.23.67-2.95 1.52-.65.75-1.22 1.95-1.07 3.1 1.13.09 2.28-.57 2.98-1.42z" />
    </svg>
  );
}
function GithubIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}

export function AuthView() {
  const { setAuth, go } = useZev();
  const [mode, setMode] = useState<"signin" | "signup">("signup");

  // shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body = mode === "signup"
        ? { email, password, name }
        : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setAuth(data.user, data.token);
      toast.success(data.message || "Success!");
      // Admins go to the dashboard, regular users go home
      if (data.user?.role === "admin") {
        go("upload");
      } else {
        go("home");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function socialClick(provider: string) {
    toast.info(`${provider} sign-in requires OAuth credentials. Please use email/password for now.`, {
      description: "Configure OAuth client IDs to enable social login.",
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="animate-float"
          >
            <ZevLogo className="h-14 w-14" />
          </motion.div>
          <h1 className="mt-4 text-3xl font-bold">
            <span className="text-gradient-mixed">Welcome to Zev</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Create your account to get started" : "Sign in to your account"}
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-3xl glass-strong p-6 ring-1 ring-border/40 sm:p-8">
          {/* Social buttons */}
          <div className="space-y-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => socialClick("Google")}
              className="w-full gap-3 glass bg-background/40 py-2.5"
            >
              <GoogleIcon /> Continue with Google
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => socialClick("Apple")}
                className="gap-2 glass bg-background/40 py-2.5"
              >
                <AppleIcon /> Apple
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => socialClick("GitHub")}
                className="gap-2 glass bg-background/40 py-2.5"
              >
                <GithubIcon /> GitHub
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 glass">
              <TabsTrigger value="signup" className="gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Sign Up
              </TabsTrigger>
              <TabsTrigger value="signin" className="gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Sign In
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" /> Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="glass" placeholder="Your name" />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass" placeholder="you@email.com" autoComplete="email" />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="glass" placeholder="At least 6 characters" autoComplete="new-password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signin" className="mt-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass" placeholder="you@email.com" autoComplete="email" />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="glass" placeholder="••••••••" autoComplete="current-password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Info note */}
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-glow/20">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-glow" />
            <p className="text-xs text-muted-foreground">
              {mode === "signup" ? (
                <>Your password is securely hashed. Admin access is granted automatically to the site owner.</>
              ) : (
                <>Don&apos;t have an account? Switch to <span className="font-semibold text-foreground">Sign Up</span> above.</>
              )}
            </p>
          </div>
        </div>

        {/* Back home */}
        <button
          onClick={() => go("home")}
          className="mt-6 flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to home
        </button>
      </motion.div>
    </div>
  );
}

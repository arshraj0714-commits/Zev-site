"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail, Lock, User as UserIcon, Loader2, ShieldCheck,
  Sparkles, ArrowRight, KeyRound, ArrowLeft, MailQuestion, Send,
} from "lucide-react";
import { useZev } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ZevLogo } from "@/components/site/logo";
import { toast } from "sonner";

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

type Phase = "form" | "verify" | "forgot" | "forgot-sent";

export function AuthView() {
  const { setAuth, go } = useZev();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [phase, setPhase] = useState<Phase>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [fallbackResetLink, setFallbackResetLink] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);

  // ---- Sign In ----
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        if (data.needsVerification) {
          await fetch("/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name }),
          });
          setPhase("verify");
          toast.info("Please verify your email. A new code has been sent.");
        } else {
          throw new Error(data.error || "Something went wrong");
        }
        return;
      }
      setAuth(data.user, data.token);
      toast.success(data.message || "Signed in!");
      if (data.user?.role === "admin") go("upload");
      else go("home");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ---- Sign Up Step 1: send verification code ----
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!tosAccepted) { toast.error("Please accept the Terms of Service to continue"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setPhase("verify");
      if (data.sent) {
        toast.success("Verification code sent! Check your email inbox.");
        setFallbackCode(null);
      } else if (data.fallbackCode) {
        setFallbackCode(data.fallbackCode);
        toast.warning("Email couldn't be sent — your code is shown below.", { duration: 6000 });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ---- Sign Up Step 2: verify code ----
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code) { toast.error("Enter the 6-digit verification code"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setAuth(data.user, data.token);
      toast.success(data.message || "Email verified! Account created.");
      if (data.user?.role === "admin") go("upload");
      else go("home");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      if (data.sent) { setFallbackCode(null); toast.success("New code sent to your email!"); }
      else if (data.fallbackCode) { setFallbackCode(data.fallbackCode); toast.info("New code generated — shown below."); }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    window.location.href = "/api/auth/google";
  }

  // ---- Forgot Password: send reset link ----
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email first"); return; }
    const emailLower = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setFallbackResetLink(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLower }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Failed to send reset link");
      setPhase("forgot-sent");
      if (data.sent) {
        toast.success("Reset link sent! Check your email inbox.");
      } else if (data.fallbackLink) {
        // Email couldn't be sent — show the reset link directly on screen
        setFallbackResetLink(data.fallbackLink);
        toast.warning("Email couldn't be sent — your reset link is shown below.", { duration: 6000 });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ---- Render helpers ----
  const TosCheckbox = ({ idSuffix }: { idSuffix: string }) => (
    <div className="flex items-start gap-2 rounded-xl bg-accent/15 p-3 ring-1 ring-border/30">
      <Checkbox
        id={`tos-check-${idSuffix}`}
        checked={tosAccepted}
        onCheckedChange={(v) => setTosAccepted(!!v)}
        className="mt-0.5"
      />
      <label htmlFor={`tos-check-${idSuffix}`} className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
        I accept the{" "}
        <button type="button" onClick={() => go("tos")} className="text-emerald-glow font-semibold hover:underline">
          Terms of Service
        </button>
        {" "}of Zev
      </label>
    </div>
  );

  // ---- FORGOT PASSWORD SENT state ----
  if (phase === "forgot-sent") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <div className="flex flex-col items-center text-center">
            <motion.div initial={{ scale: 0.8, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
              <ZevLogo className="h-14 w-14" />
            </motion.div>
            <h1 className="mt-4 text-3xl font-bold"><span className="text-gradient-mixed">Check Your Email</span></h1>
            <p className="mt-1 text-sm text-muted-foreground">We&apos;ve sent a password reset link to your inbox</p>
          </div>
          <div className="mt-8 rounded-3xl glass-strong p-6 ring-1 ring-border/40 sm:p-8">
            <div className="flex flex-col items-center text-center py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-gold/20 ring-1 ring-emerald-glow/30">
                <MailQuestion className="h-7 w-7 text-emerald-glow" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>, a reset link is on its way.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Click the link in your email (it expires in 10 minutes) to choose a new password.
              </p>
            </div>
            {fallbackResetLink && (
              <div className="rounded-xl bg-amber-500/10 p-4 ring-1 ring-amber-500/30 text-center">
                <p className="text-xs text-amber-400 font-medium mb-2">Email couldn&apos;t be sent. Use this reset link:</p>
                <p className="text-xs text-muted-foreground mb-3">Click the button below to open the password reset page. The link expires in 10 minutes.</p>
                <a
                  href={fallbackResetLink}
                  className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 text-sm font-semibold hover:from-emerald-400 hover:to-emerald-300 transition-colors"
                >
                  Reset My Password
                </a>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(fallbackResetLink); toast.success("Reset link copied to clipboard!"); }}
                  className="block mx-auto mt-2 text-xs text-amber-400 hover:underline"
                >
                  Or copy link manually
                </button>
              </div>
            )}
            <Button onClick={() => { setPhase("form"); setMode("signin"); setFallbackResetLink(null); }} className="mt-6 w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300">
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---- FORGOT PASSWORD form state ----
  if (phase === "forgot") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <div className="flex flex-col items-center text-center">
            <motion.div initial={{ scale: 0.8, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
              <ZevLogo className="h-14 w-14" />
            </motion.div>
            <h1 className="mt-4 text-3xl font-bold"><span className="text-gradient-mixed">Forgot Password?</span></h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link</p>
          </div>
          <div className="mt-8 rounded-3xl glass-strong p-6 ring-1 ring-border/40 sm:p-8">
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="flex flex-col items-center text-center py-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-gold/20 ring-1 ring-emerald-glow/30">
                  <MailQuestion className="h-7 w-7 text-emerald-glow" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  We&apos;ll email you a secure, one-time link to set a new password. The link is valid for 10 minutes only.
                </p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass"
                  placeholder="you@email.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? "Sending..." : "Send Code"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => setPhase("form")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.8, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
            <ZevLogo className="h-14 w-14" />
          </motion.div>
          <h1 className="mt-4 text-3xl font-bold"><span className="text-gradient-mixed">{phase === "verify" ? "Verify Your Email" : "Welcome to Zev"}</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {phase === "verify" ? `Enter the 6-digit code sent to ${email}` : mode === "signup" ? "Create your account to get started" : "Sign in to your account"}
          </p>
        </div>

        <div className="mt-8 rounded-3xl glass-strong p-6 ring-1 ring-border/40 sm:p-8">
          {phase === "verify" ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="flex flex-col items-center text-center py-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-gold/20 ring-1 ring-emerald-glow/30">
                    <KeyRound className="h-7 w-7 text-emerald-glow" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {fallbackCode ? "Email delivery is not configured. Your code is shown below." : <>We sent a 6-digit code to<br/><span className="font-semibold text-foreground">{email}</span></>}
                  </p>
                </div>
                {fallbackCode && (
                  <div className="rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-glow/30 text-center">
                    <p className="text-xs text-emerald-glow font-medium mb-1">Your verification code:</p>
                    <p className="text-3xl font-mono font-bold tracking-[0.4em] text-foreground">{fallbackCode}</p>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(fallbackCode); setCode(fallbackCode); toast.success("Code copied & entered!"); }} className="mt-2 text-xs text-emerald-glow hover:underline">Click to copy & enter</button>
                  </div>
                )}
                <div>
                  <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Verification Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="glass text-center text-2xl font-mono tracking-[0.5em]" placeholder="000000" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
                </div>
                {/* TOS checkbox above the Verify button */}
                <TosCheckbox idSuffix="verify" />
                <Button type="submit" disabled={loading || code.length !== 6 || !tosAccepted} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={() => setPhase("form")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back</button>
                  <button type="button" onClick={handleResendCode} disabled={loading} className="text-emerald-glow hover:underline">Resend code</button>
                </div>
              </form>
            </motion.div>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleGoogleSignIn} className="w-full gap-3 glass bg-background/40 py-2.5 hover:bg-background/60">
                <GoogleIcon /> Continue with Google
              </Button>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">or use email</span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
                <TabsList className="grid w-full grid-cols-2 glass">
                  <TabsTrigger value="signup" className="gap-1.5"><UserIcon className="h-3.5 w-3.5" /> Sign Up</TabsTrigger>
                  <TabsTrigger value="signin" className="gap-1.5"><Lock className="h-3.5 w-3.5" /> Sign In</TabsTrigger>
                </TabsList>
                <TabsContent value="signup" className="mt-5">
                  <form onSubmit={handleSendCode} className="space-y-4">
                    <div><Label className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" /> Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="glass" placeholder="Your name" /></div>
                    <div><Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass" placeholder="you@email.com" autoComplete="email" /></div>
                    <div><Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="glass" placeholder="At least 6 characters" autoComplete="new-password" /></div>
                    {/* TOS checkbox above the Send Verification Code button */}
                    <TosCheckbox idSuffix="signup" />
                    <Button type="submit" disabled={loading || !tosAccepted} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      {loading ? "Sending code..." : "Send Verification Code"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signin" className="mt-5">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div><Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass" placeholder="you@email.com" autoComplete="email" /></div>
                    <div><Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="glass" placeholder="••••••••" autoComplete="current-password" /></div>
                    {/* Forgot Password link */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setPhase("forgot"); setPassword(""); }}
                        className="text-xs text-emerald-glow hover:underline font-medium"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-glow/20">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-glow" />
                <p className="text-xs text-muted-foreground">
                  {mode === "signup" ? <>We&apos;ll send a 6-digit verification code to your email. Enter it to complete signup. Your password is securely hashed.</> : <>Don&apos;t have an account? Switch to <span className="font-semibold text-foreground">Sign Up</span> above.</>}
                </p>
              </div>
            </>
          )}
        </div>
        {phase === "form" && (
          <button onClick={() => go("home")} className="mt-6 flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">← Back to home</button>
        )}
      </motion.div>
    </div>
  );
}

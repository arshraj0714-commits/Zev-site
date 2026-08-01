"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, ShieldCheck, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useZev } from "@/lib/store";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function TosView() {
  const { go, admin, setAuth, authToken } = useZev();
  const [accepting, setAccepting] = useState(false);

  // Check if current user already accepted TOS
  const alreadyAccepted = admin?.tosAccepted === true || (admin as any)?.tosAccepted === true;

  async function handleAcceptTos() {
    if (!authToken) {
      toast.error("Please sign in to accept the Terms of Service.");
      go("auth");
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch("/api/auth/accept-tos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data.error || "Failed to accept TOS");
      // Update the user in store
      if (data.user) {
        setAuth(data.user, authToken);
      }
      toast.success("Terms of Service accepted! You can now use all features of Zev.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Legal"
        title="Terms of Service"
        subtitle="Zev — Premium Discord Tools & Bots by Arsh"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-2xl glass-bubble glass-bubble-hover p-6 sm:p-10"
      >
        <div className="mb-6 flex items-center gap-3 border-b border-border/40 pb-4">
          <FileText className="h-6 w-6 text-gold" />
          <div>
            <h2 className="text-xl font-bold">Terms of Service</h2>
            <p className="text-xs text-muted-foreground">Last Updated: July 28, 2026</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <div>
            <p className="text-foreground font-semibold">Website:</p> https://zevdev.vercel.app/
            <br />
            <p className="text-foreground font-semibold mt-2">Operator:</p> Arsh Raj Sharma ("Arsh," "we," "us," "our")
            <br />
            <p className="text-foreground font-semibold mt-2">Discord Support Server:</p>{" "}
            <a href="https://discord.com/invite/MAExCtnuu6" target="_blank" rel="noopener noreferrer" className="text-emerald-glow hover:underline">
              https://discord.com/invite/MAExCtnuu6
            </a>
            <br />
            <p className="text-foreground font-semibold mt-2">Discord Contact:</p> escapingdum
          </div>

          <Section number="1" title="Acceptance of Terms">
            By accessing or using Zev (the "Site"), browsing the Marketplace, Open Source section, or Stock & Accounts section, creating an account, or making a purchase, you ("Customer," "Buyer," "you") agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Site or purchase any product or service from Zev.
            <br /><br />
            Arsh reserves the right to update or modify these Terms at any time without prior notice. Continued use of the Site after changes are posted constitutes acceptance of the revised Terms. It is your responsibility to review these Terms periodically.
          </Section>

          <Section number="2" title="About Zev">
            Zev is a digital marketplace operated by Arsh Raj Sharma, offering:
            <ul className="ml-4 mt-2 list-disc">
              <li><strong className="text-foreground">Marketplace</strong> — Premium, paid Discord bots, tools, and automation scripts.</li>
              <li><strong className="text-foreground">Open Source</strong> — Free, publicly available code and tools.</li>
              <li><strong className="text-foreground">Stock & Accounts</strong> — Pre-provisioned digital stock items and/or account-based products.</li>
            </ul>
            All paid products are delivered digitally. Zev does not sell or ship any physical goods.
          </Section>

          <Section number="3" title="Payments">
            <p className="text-foreground font-semibold mt-3">3.1 Accepted Payment Methods</p>
            Zev accepts cryptocurrency payments only: Bitcoin (BTC), Litecoin (LTC), Solana (SOL), and USDT. Live conversion rates are fetched from CoinGecko at the time of purchase.
            <p className="text-foreground font-semibold mt-3">3.2 On-Chain Verification</p>
            All payments are verified automatically by scanning the relevant blockchain for a transaction matching the exact destination wallet address and exact payment amount. Delivery is triggered automatically once your transaction is confirmed on-chain.
            <p className="text-foreground font-semibold mt-3">3.3 Buyer Responsibility for Payment Accuracy</p>
            You are solely responsible for sending the correct cryptocurrency to the correct wallet address, sending the exact amount requested, and using a compatible wallet/network.
            <p className="text-foreground font-semibold mt-3">3.4 No Chargebacks</p>
            All transactions are final and non-reversible. Refunds, where applicable, are issued manually by Arsh at his discretion.
          </Section>

          <Section number="4" title="Warranty & Refund Policy">
            <p className="text-foreground font-semibold mt-3">4.1 7-Day Full Warranty</p>
            Every paid product comes with a 7-day full warranty from the date of successful delivery.
            <p className="text-foreground font-semibold mt-3">4.2 7-Day Full Refund Window</p>
            Within 7 days of delivery, you are entitled to a full refund if the product does not work as described, is missing/corrupted, or was misrepresented.
            <p className="text-foreground font-semibold mt-3">4.3 After 7 Days — No Standard Refunds</p>
            Once the 7-day window passes, refund requests will not be accepted as standard policy.
            <p className="text-foreground font-semibold mt-3">4.4 Special-Case Refunds (Owner Discretion)</p>
            In exceptional circumstances, Arsh may issue a refund after the 7-day window at his sole discretion. Clear proof must be provided.
            <p className="text-foreground font-semibold mt-3">4.5 Guaranteed 100% Refund — Product Unavailability</p>
            If a product is unavailable after payment, you are entitled to a 100% refund regardless of the 7-day window.
            <p className="text-foreground font-semibold mt-3">4.6 Refund Method</p>
            Approved refunds will be issued to a cryptocurrency wallet address provided by the buyer.
          </Section>

          <Section number="5" title="Missing or Faulty Product Delivery">
            If your product is missing or not delivered after verified payment, DM Arsh on Discord at escapingdum or open a support ticket in the Discord Support Server. Arsh will deliver the missing product or issue a 100% refund if unavailable.
          </Section>

          <Section number="6" title="Open Source Products">
            Open source code is provided "as is," without any warranty. Use is entirely at your own risk.
          </Section>

          <Section number="7" title="Stock & Accounts">
            Products under Stock & Accounts are subject to the same 7-day warranty and refund terms unless stated otherwise.
          </Section>

          <Section number="8" title="Customer Support">
            Discord DM: escapingdum | Discord Support Server: https://discord.com/invite/MAExCtnuu6
          </Section>

          <Section number="9" title="Acceptable Use">
            You agree not to use products for illegal activity, exploit or redistribute paid products, abuse the refund system, or manipulate the payment verification system.
          </Section>

          <Section number="10" title="Ownership & License">
            Paid products remain the intellectual property of Arsh Raj Sharma. Purchase grants a personal, non-exclusive, non-transferable license.
          </Section>

          <Section number="11" title="No Guarantee of Uptime or Continued Service">
            Zev does not guarantee 100% uptime and is not liable for third-party platform outages.
          </Section>

          <Section number="12" title="Limitation of Liability">
            Arsh shall not be liable for indirect, incidental, or punitive damages. Total liability shall not exceed the amount paid for the relevant product.
          </Section>

          <Section number="13" title="Changes to Products and Pricing">
            Arsh reserves the right to modify, update, discontinue, or change pricing at any time without prior notice.
          </Section>

          <Section number="14" title="Governing Terms & Disputes">
            These Terms constitute the entire agreement. Disputes should first be raised through the Discord Support Server.
          </Section>

          <Section number="15" title="Contact">
            Discord: escapingdum | Support Server: https://discord.com/invite/MAExCtnuu6
          </Section>

          <p className="border-t border-border/40 pt-4 text-center text-xs italic text-muted-foreground">
            By using Zev, you confirm that you have read, understood, and agreed to these Terms of Service in full.
          </p>
        </div>

        {/* Accept TOS button — only for logged-in users who haven't accepted */}
        {admin && !alreadyAccepted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-xl bg-emerald-500/10 p-6 ring-1 ring-emerald-glow/30 text-center"
          >
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-glow" />
            <h3 className="mt-3 text-lg font-bold">Accept Terms of Service</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You need to accept the Terms of Service to continue using Zev.
            </p>
            <Button
              onClick={handleAcceptTos}
              disabled={accepting}
              className="mt-4 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {accepting ? "Accepting..." : "I Accept the Terms of Service"}
            </Button>
          </motion.div>
        )}

        {/* Already accepted badge */}
        {admin && alreadyAccepted && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/5 p-4 text-sm text-emerald-glow">
            <CheckCircle2 className="h-4 w-4" />
            You have accepted the Terms of Service.
          </div>
        )}
      </motion.div>

      <button onClick={() => go("home")} className="mt-8 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </button>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/20 pt-4">
      <h3 className="mb-2 text-base font-bold text-foreground">{number}. {title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

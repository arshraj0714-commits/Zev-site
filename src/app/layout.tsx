import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zev | Premium Discord Tools & Bots by Arsh",
  description:
    "Zev — Professional Discord bots, tools, and digital marketplace by Arsh Raj Sharma. Buy premium tools with crypto (LTC/BTC/SOL/USDT) or grab free open-source code.",
  keywords: ["Zev", "Arsh", "Discord bots", "Discord tools", "crypto marketplace", "LTC", "BTC", "SOL", "USDT"],
  authors: [{ name: "Arsh Raj Sharma" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "Zev | Premium Discord Tools & Bots",
    description: "Professional Discord tools, bots & marketplace by Arsh Raj Sharma.",
    siteName: "Zev",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}

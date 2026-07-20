"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Background3D } from "@/components/site/background";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { CheckoutModal } from "@/components/checkout/checkout-modal";
import { useZev, type ViewId } from "@/lib/store";
import { HomeView } from "@/components/views/home-view";
import { ProductsView } from "@/components/views/products-view";
import { OpenSourceView } from "@/components/views/opensource-view";
import { StockView } from "@/components/views/stock-view";
import { UploadView } from "@/components/views/upload-view";
import { AboutView } from "@/components/views/about-view";
import { AuthView } from "@/components/views/auth-view";
import { OrdersView } from "@/components/views/orders-view";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function ViewRouter() {
  const view = useZev((s) => s.view);

  const views: Record<ViewId, React.ReactNode> = {
    home: <HomeView />,
    products: <ProductsView />,
    opensource: <OpenSourceView />,
    stock: <StockView />,
    upload: <UploadView />,
    about: <AboutView />,
    auth: <AuthView />,
    orders: <OrdersView />,
  };

  return (
    <main className="flex-1">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {views[view]}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

export default function Home() {
  // ensure query client is stable per-render on client
  const [client] = useState(() => queryClient);

  return (
    <QueryClientProvider client={client}>
      <div className="relative flex min-h-screen flex-col">
        <Background3D />
        <Navbar />
        <ViewRouter />
        <Footer />
        <CheckoutModal />
      </div>
    </QueryClientProvider>
  );
}

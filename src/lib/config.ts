// Zev site configuration — payment wallets & owner info
// Owner: Arsh Raj Sharma (Zev)

export const SITE_CONFIG = {
  name: "Zev",
  owner: {
    name: "Arsh Raj Sharma",
    shortName: "Arsh",
    discord: "escapingdum(Arsh)",
    discordSupportServer: "https://discord.gg/MAExCtnuu6",
    org: "Z Discord Tools/Bots Dev",
    role: "Founder & Lead Developer",
  },
  rights: "All rights reserved.",
  stats: {
    vouches: 1000,
    productsSold: 1573,
  },
};

// Crypto wallet addresses owned by Arsh
export const WALLET_ADDRESSES = {
  LTC: "LhdpCbbxsqLtF7jssTGLWLYBKsnSgjTk3x",
  SOL: "4i7hn4miHGiMFSceM5KfEc21VRwZ7AKAC5vFpds4GFv2",
  BTC: "bc1qhsrsqrvy4k9pxuyktn9xz7w8dt092lzd5xjeqs",
  // USDT on BNB Smart Chain (BEP20)
  USDT: "0xD21Db04f0895C8a715775796dAD28DA3c1c0c811",
} as const;

export type CryptoMethod = keyof typeof WALLET_ADDRESSES;

export const PAYMENT_METHODS: {
  id: CryptoMethod;
  name: string;
  symbol: string;
  chain: string;
  explorer: string;
  explorerTx: string;
  color: string;
  coingeckoId: string;
}[] = [
  {
    id: "LTC",
    name: "Litecoin",
    symbol: "LTC",
    chain: "Litecoin Mainnet",
    explorer: "https://litecoinspace.org",
    explorerTx: "https://litecoinspace.org/tx/",
    color: "#345d9b",
    coingeckoId: "litecoin",
  },
  {
    id: "BTC",
    name: "Bitcoin",
    symbol: "BTC",
    chain: "Bitcoin Mainnet",
    explorer: "https://btcscan.org",
    explorerTx: "https://btcscan.org/tx/",
    color: "#f7931a",
    coingeckoId: "bitcoin",
  },
  {
    id: "SOL",
    name: "Solana",
    symbol: "SOL",
    chain: "Solana Mainnet",
    explorer: "https://solscan.io",
    explorerTx: "https://solscan.io/tx/",
    color: "#14f195",
    coingeckoId: "solana",
  },
  {
    id: "USDT",
    name: "Tether USD",
    symbol: "USDT",
    chain: "BNB Smart Chain (BEP20)",
    explorer: "https://bscscan.com",
    explorerTx: "https://bscscan.com/tx/",
    color: "#26a17b",
    coingeckoId: "tether",
  },
];

// USDT BEP20 contract address on BSC
export const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

// Price cache (in-memory, refreshed periodically)
let priceCache: Record<string, number> | null = null;
let priceCacheTime = 0;
const PRICE_CACHE_TTL = 60_000; // 1 minute

export async function getCryptoPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (priceCache && now - priceCacheTime < PRICE_CACHE_TTL) {
    return priceCache;
  }
  try {
    const ids = PAYMENT_METHODS.map((m) => m.coingeckoId).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error("price fetch failed");
    const data = (await res.json()) as Record<string, { usd: number }>;
    const prices: Record<string, number> = {};
    for (const m of PAYMENT_METHODS) {
      prices[m.id] = data[m.coingeckoId]?.usd ?? 0;
    }
    priceCache = prices;
    priceCacheTime = now;
    return prices;
  } catch {
    // Fallback approximate prices
    const fallback: Record<string, number> = {
      LTC: 85,
      BTC: 67000,
      SOL: 160,
      USDT: 1,
    };
    priceCache = fallback;
    priceCacheTime = now;
    return fallback;
  }
}

// Convert USD amount to crypto amount for a given method
export async function usdToCrypto(
  usd: number,
  method: CryptoMethod
): Promise<number> {
  const prices = await getCryptoPrices();
  const price = prices[method] ?? 0;
  if (price <= 0) return 0;
  return usd / price;
}

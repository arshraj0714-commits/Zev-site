// Blockchain payment verification service for Zev
// Production-grade with multi-tier fallback: primary API → public RPC → backup RPC
// BTC: Blockstream | LTC: LitecoinSpace | SOL: Helius → public → publicnode | USDT: BscScan → BSC dataseed → publicnode

import { WALLET_ADDRESSES, USDT_BSC_CONTRACT, type CryptoMethod } from "./config";

export interface ScanResult {
  verified: boolean;
  found: boolean;
  confirmed: boolean;
  matchedAddress: boolean;
  matchedAmount: boolean;
  amountReceived: number;
  txHash: string | null;
  explorerUrl: string;
  checkedAddress: string;
  expectedAmount: number;
  confirmations: number;
  verificationSource: string;
  error?: string;
}

const SOL_LAMPORTS = 1_000_000_000;
const USDT_DECIMALS = 18;
const TIME_TOLERANCE_SECONDS = 5 * 60;
const MAX_TX_AGE_SECONDS = 30 * 60;

// In-memory tx cache
const txCache = new Map<string, number>();
const TX_CACHE_TTL = 5 * 60 * 1000;

function isTxCached(method: string, txHash: string): boolean {
  const key = `${method}:${txHash}`;
  const cached = txCache.get(key);
  if (cached && Date.now() - cached < TX_CACHE_TTL) return true;
  return false;
}

function cacheTx(method: string, txHash: string) {
  txCache.set(`${method}:${txHash}`, Date.now());
}

// Retry wrapper
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1000): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries) {
        console.error(`[payments] Retry exhausted:`, (e as Error).message);
        return null;
      }
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  return null;
}

// Try multiple fetch URLs in order — returns first successful response
async function fetchWithFallback(urls: string[], options?: RequestInit): Promise<Response | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.warn(`[payments] Fallback URL failed (${res.status}): ${url.substring(0, 60)}...`);
    } catch (e) {
      console.warn(`[payments] Fallback URL error: ${url.substring(0, 60)}... — ${(e as Error).message}`);
    }
  }
  return null;
}

// ---------- BTC: Blockstream Esplora API ----------
async function scanBTC(addr: string, expectedAmount: number, sinceTimestamp: number, usedTxHashes: Set<string>): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAddress: false,
    matchedAmount: false, amountReceived: 0, txHash: null,
    explorerUrl: `https://btcscan.org/address/${addr}`,
    checkedAddress: addr, expectedAmount, confirmations: 0,
    verificationSource: "blockstream",
  };
  try {
    const [memRes, confRes] = await Promise.all([
      withRetry(() => fetch(`https://blockstream.info/api/address/${addr}/txs/mempool`)),
      withRetry(() => fetch(`https://blockstream.info/api/address/${addr}/txs`)),
    ]);
    const memTxs = memRes?.ok ? await memRes.json() : [];
    const confTxs = confRes?.ok ? await confRes.json() : [];
    const allTxs: any[] = [...(Array.isArray(memTxs) ? memTxs : []), ...(Array.isArray(confTxs) ? confTxs : [])];

    const expectedSats = Math.round(expectedAmount * 1e8);
    const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - MAX_TX_AGE_SECONDS;

    for (const tx of allTxs) {
      const txid: string = tx.txid;
      if (!txid || usedTxHashes.has(txid) || isTxCached("BTC", txid)) continue;
      const blockTime: number | undefined = tx.status?.block_time;
      const isMempool = !tx.status?.confirmed;
      if (!isMempool) {
        if (typeof blockTime !== "number" || blockTime < minTime || blockTime < maxAge) continue;
      }
      let received = 0;
      for (const vout of tx.vout ?? []) {
        if (vout.scriptpubkey_address === addr) received += vout.value ?? 0;
      }
      if (received > 0) {
        base.found = true;
        cacheTx("BTC", txid);
        if (received >= expectedSats) {
          base.matchedAmount = true;
          base.amountReceived = received / 1e8;
          base.txHash = txid;
          base.confirmed = !!tx.status?.confirmed;
          base.matchedAddress = true;
          base.confirmations = tx.status?.confirmed ? 1 : 0;
          base.explorerUrl = `https://btcscan.org/tx/${txid}`;
          base.verified = true;
          console.log(`[BTC] Payment verified: tx=${txid}, amount=${received / 1e8} BTC`);
          return base;
        }
      }
    }
    return base;
  } catch (e) {
    return { ...base, error: `BTC scan failed: ${(e as Error).message}` };
  }
}

// ---------- LTC: LitecoinSpace API ----------
async function scanLTC(addr: string, expectedAmount: number, sinceTimestamp: number, usedTxHashes: Set<string>): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAddress: false,
    matchedAmount: false, amountReceived: 0, txHash: null,
    explorerUrl: `https://litecoinspace.org/address/${addr}`,
    checkedAddress: addr, expectedAmount, confirmations: 0,
    verificationSource: "litecoinspace",
  };
  try {
    const res = await withRetry(() => fetch(`https://litecoinspace.org/api/address/${addr}/txs`));
    if (!res?.ok) return { ...base, error: `LitecoinSpace error (${res?.status})` };
    const txs: any[] = await res.json();
    if (!Array.isArray(txs)) return base;

    const expectedSats = Math.round(expectedAmount * 1e8);
    const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - MAX_TX_AGE_SECONDS;

    for (const tx of txs) {
      const txid: string = tx.txid;
      if (!txid || usedTxHashes.has(txid) || isTxCached("LTC", txid)) continue;
      const blockTime = tx.status?.block_time;
      const isMempool = !tx.status?.confirmed;
      if (!isMempool) {
        if (typeof blockTime !== "number" || blockTime < minTime || blockTime < maxAge) continue;
      }
      let received = 0;
      for (const vout of tx.vout ?? []) {
        if (vout.scriptpubkey_address === addr) received += vout.value ?? 0;
      }
      if (received > 0) {
        base.found = true;
        cacheTx("LTC", txid);
        if (received >= expectedSats) {
          base.matchedAmount = true;
          base.amountReceived = received / 1e8;
          base.txHash = txid;
          base.confirmed = !!tx.status?.confirmed;
          base.matchedAddress = true;
          base.confirmations = tx.status?.confirmed ? 1 : 0;
          base.explorerUrl = `https://litecoinspace.org/tx/${txid}`;
          base.verified = true;
          console.log(`[LTC] Payment verified: tx=${txid}, amount=${received / 1e8} LTC`);
          return base;
        }
      }
    }
    return base;
  } catch (e) {
    return { ...base, error: `LTC scan failed: ${(e as Error).message}` };
  }
}

// ---------- SOL: Helius RPC → public Solana RPC → publicnode fallback ----------
async function scanSOL(addr: string, expectedAmount: number, sinceTimestamp: number, usedTxHashes: Set<string>): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAddress: false,
    matchedAmount: false, amountReceived: 0, txHash: null,
    explorerUrl: `https://solscan.io/account/${addr}`,
    checkedAddress: addr, expectedAmount, confirmations: 0,
    verificationSource: "helius",
  };

  // Fallback chain: Helius (primary) → public Solana RPC → publicnode
  const heliusKey = process.env.HELIUS_API_KEY;
  const rpcUrls = [
    ...(heliusKey ? [`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`] : []),
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
  ];
  console.log(`[SOL] API key configured: ${heliusKey ? "YES (Helius primary)" : "NO (using public RPC)"}`);

  const expectedLamports = Math.round(expectedAmount * SOL_LAMPORTS);
  const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const maxAge = now - MAX_TX_AGE_SECONDS;

  let sigs: any[] = [];
  let usedSource = "helius";

  // Try each RPC to get signatures
  for (let i = 0; i < rpcUrls.length; i++) {
    const rpcUrl = rpcUrls[i];
    const sourceName = i === 0 ? "helius" : i === 1 ? "solana-public" : "publicnode";
    try {
      console.log(`[SOL] Trying ${sourceName} for signatures...`);
      const sigRes = await withRetry(() => fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
          params: [addr, { limit: 20 }],
        }),
      }));
      if (!sigRes?.ok) { console.warn(`[SOL] ${sourceName} returned ${sigRes?.status}`); continue; }
      const sigJson = await sigRes.json();
      if (Array.isArray(sigJson?.result) && sigJson.result.length >= 0) {
        sigs = sigJson.result;
        usedSource = sourceName;
        base.verificationSource = sourceName;
        console.log(`[SOL] Got ${sigs.length} signatures from ${sourceName}`);
        break;
      }
    } catch (e) {
      console.warn(`[SOL] ${sourceName} failed: ${(e as Error).message}`);
    }
  }

  if (sigs.length === 0) {
    return { ...base, error: "All SOL RPCs failed or returned no data" };
  }

  // For each signature, try to get the transaction (with fallback RPCs)
  for (const sig of sigs) {
    const signature: string = sig.signature;
    if (!signature || usedTxHashes.has(signature) || isTxCached("SOL", signature)) continue;

    const blockTime: number | undefined = sig.blockTime;
    if (typeof blockTime !== "number" || blockTime < minTime || blockTime < maxAge) continue;

    // Try each RPC for getTransaction
    let tx: any = null;
    for (let i = 0; i < rpcUrls.length; i++) {
      const rpcUrl = rpcUrls[i];
      try {
        const txRes = await withRetry(() => fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getTransaction",
            params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
        }), 1, 500); // fewer retries for individual tx fetches
        if (!txRes?.ok) continue;
        const txJson = await txRes.json();
        if (txJson?.result) { tx = txJson.result; break; }
      } catch { /* try next RPC */ }
    }
    if (!tx) continue;

    let receivedLamports = 0;
    let matched = false;
    const instructions = tx.transaction?.message?.instructions ?? [];
    const innerInstructions = tx.meta?.innerInstructions ?? [];
    const allInstr = [...instructions, ...innerInstructions.flatMap((i: any) => i.instructions ?? [])];
    for (const ix of allInstr) {
      const parsed = ix?.parsed;
      if (parsed?.type === "transfer" && parsed.info) {
        if (parsed.info.destination === addr) {
          matched = true;
          receivedLamports += parsed.info.lamports ?? 0;
        }
      }
    }
    if (!matched) {
      const postBalances: number[] = tx.meta?.postBalances ?? [];
      const preBalances: number[] = tx.meta?.preBalances ?? [];
      const accountKeys: string[] = tx.transaction?.message?.accountKeys?.map((k: any) => typeof k === "string" ? k : k.pubkey) ?? [];
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys[i] === addr) {
          const delta = (postBalances[i] ?? 0) - (preBalances[i] ?? 0);
          if (delta > 0) { matched = true; receivedLamports += delta; }
        }
      }
    }
    if (matched) {
      base.found = true;
      cacheTx("SOL", signature);
      if (receivedLamports >= expectedLamports) {
        base.matchedAmount = true;
        base.amountReceived = receivedLamports / SOL_LAMPORTS;
        base.txHash = signature;
        base.confirmed = !sig.err;
        base.matchedAddress = true;
        base.confirmations = sig.confirmationStatus === "finalized" ? 32 : 1;
        base.explorerUrl = `https://solscan.io/tx/${signature}`;
        base.verified = true;
        console.log(`[SOL] Payment verified: tx=${signature}, amount=${receivedLamports / SOL_LAMPORTS} SOL, source=${usedSource}`);
        return base;
      }
    }
  }
  return base;
}

// ---------- USDT (BEP-20): BscScan API → BSC dataseed RPC fallback ----------
async function scanUSDT(addr: string, expectedAmount: number, sinceTimestamp: number, usedTxHashes: Set<string>): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAddress: false,
    matchedAmount: false, amountReceived: 0, txHash: null,
    explorerUrl: `https://bscscan.com/address/${addr}`,
    checkedAddress: addr, expectedAmount, confirmations: 0,
    verificationSource: "bscscan",
  };

  const expectedRaw = BigInt(Math.round(expectedAmount * 10 ** USDT_DECIMALS));
  const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const maxAge = now - MAX_TX_AGE_SECONDS;
  const addrLower = addr.toLowerCase();
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const toTopic = "0x000000000000000000000000" + addrLower.slice(2);

  // ---- TIER 1: BscScan API ----
  const bscscanKey = process.env.BSCSCAN_API_KEY;
  console.log(`[USDT] API key configured: ${bscscanKey ? "YES (BscScan primary)" : "NO (using BSC RPC fallback)"}`);
  if (bscscanKey) {
    try {
      console.log(`[USDT] Trying BscScan API...`);
      const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_BSC_CONTRACT}&address=${addr}&page=1&offset=20&sort=desc&apikey=${bscscanKey}`;
      const res = await withRetry(() => fetch(url));
      if (res?.ok) {
        const data = await res.json();
        console.log(`[USDT] BscScan response: status=${data?.status}, message=${data?.message}, results=${Array.isArray(data?.result) ? data.result.length : "N/A"}`);
        const txs: any[] = data?.result ?? [];
        if (Array.isArray(txs) && txs.length > 0) {
          console.log(`[USDT] BscScan returned ${txs.length} transfers`);
          base.verificationSource = "bscscan";
          for (const tx of txs) {
            const txHash: string = tx.hash;
            if (!txHash || usedTxHashes.has(txHash) || isTxCached("USDT", txHash)) continue;
            const to = (tx.to || "").toLowerCase();
            if (to !== addrLower) continue;
            const contract = (tx.contractAddress || "").toLowerCase();
            if (contract !== USDT_BSC_CONTRACT.toLowerCase()) continue;
            let amount: bigint;
            try { amount = BigInt(tx.value || "0"); } catch { continue; }
            const txTime = parseInt(tx.timeStamp || "0", 10);
            if (txTime && (txTime < minTime || txTime < maxAge)) continue;
            const confirmations = parseInt(tx.confirmations || "0", 10);
            base.found = true;
            cacheTx("USDT", txHash);
            if (amount >= expectedRaw) {
              base.matchedAmount = true;
              base.amountReceived = Number(amount) / 10 ** USDT_DECIMALS;
              base.txHash = txHash;
              base.confirmed = confirmations > 0;
              base.matchedAddress = true;
              base.confirmations = confirmations;
              base.explorerUrl = `https://bscscan.com/tx/${txHash}`;
              base.verified = true;
              console.log(`[USDT] ✅ Payment verified via BscScan: tx=${txHash}, amount=${base.amountReceived} USDT`);
              return base;
            }
          }
          // BscScan worked — no matching payment found
          console.log(`[USDT] BscScan worked but no matching payment found`);
          return base;
        } else {
          // BscScan returned 0 transfers — this is valid (no USDT sent to this address)
          console.log(`[USDT] BscScan returned 0 transfers (no USDT sent to this wallet) — using BscScan result`);
          base.verificationSource = "bscscan";
          return base;
        }
      }
      console.warn(`[USDT] BscScan HTTP error (${res?.status}) — falling back to BSC RPC`);
    } catch (e) {
      console.warn(`[USDT] BscScan error: ${(e as Error).message}`);
    }
  }

  // ---- TIER 2: BSC dataseed RPC (eth_getLogs) ----
  // Fallback RPCs: Binance dataseed → publicnode
  const bscRpcs = [
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.binance.org",
    "https://bsc.publicnode.com",
  ];

  for (let i = 0; i < bscRpcs.length; i++) {
    const rpc = bscRpcs[i];
    const sourceName = i === 0 ? "bsc-dataseed" : i === 1 ? "bsc-dataseed1" : "publicnode";
    try {
      console.log(`[USDT] Trying ${sourceName} RPC...`);

      // Get latest block
      const blockRes = await withRetry(() => fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      }));
      if (!blockRes?.ok) { console.warn(`[USDT] ${sourceName} blockNumber failed`); continue; }
      const blockJson = await blockRes.json();
      const latest = parseInt(blockJson.result ?? "0x0", 16);
      const fromBlock = "0x" + Math.max(0, latest - 5000).toString(16);

      // Fetch USDT Transfer logs to our address
      const logsRes = await withRetry(() => fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "eth_getLogs",
          params: [{ address: USDT_BSC_CONTRACT, topics: [transferTopic, null, toTopic], fromBlock, toBlock: "latest" }],
        }),
      }));
      if (!logsRes?.ok) { console.warn(`[USDT] ${sourceName} getLogs failed`); continue; }
      const logsJson = await logsRes.json();
      const logs: any[] = logsJson?.result ?? [];
      if (!Array.isArray(logs)) { console.warn(`[USDT] ${sourceName} returned no logs array`); continue; }

      console.log(`[USDT] ${sourceName} returned ${logs.length} transfer logs`);

      // Sort newest-first
      const sortedLogs = [...logs].sort((a, b) => {
        try { return parseInt(b.blockNumber ?? "0x0", 16) - parseInt(a.blockNumber ?? "0x0", 16); }
        catch { return 0; }
      });

      base.verificationSource = sourceName;
      for (const log of sortedLogs) {
        const txHash: string = log.transactionHash;
        if (!txHash || usedTxHashes.has(txHash) || isTxCached("USDT", txHash)) continue;

        // Fetch block timestamp for time filtering
        let blockTimestamp: number | undefined;
        try {
          const blkRes = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: [log.blockNumber, false] }),
          });
          if (blkRes.ok) {
            const blkJson = await blkRes.json();
            blockTimestamp = blkJson?.result?.timestamp ? parseInt(blkJson.result.timestamp, 16) : undefined;
          }
        } catch { /* skip block fetch */ }

        if (typeof blockTimestamp === "number" && (blockTimestamp < minTime || blockTimestamp < maxAge)) continue;

        let amount: bigint;
        try { amount = BigInt(log.data ?? "0x0"); } catch { continue; }
        base.found = true;
        cacheTx("USDT", txHash);

        if (amount >= expectedRaw) {
          base.matchedAmount = true;
          base.amountReceived = Number(amount) / 10 ** USDT_DECIMALS;
          base.txHash = txHash;
          base.confirmed = true;
          base.matchedAddress = true;
          base.confirmations = 1;
          base.explorerUrl = `https://bscscan.com/tx/${txHash}`;
          base.verified = true;
          console.log(`[USDT] Payment verified via ${sourceName}: tx=${txHash}, amount=${base.amountReceived} USDT`);
          return base;
        }
      }
      // This RPC worked but no match — return (don't try other RPCs)
      return base;
    } catch (e) {
      console.warn(`[USDT] ${sourceName} RPC error: ${(e as Error).message}`);
    }
  }

  return { ...base, error: "All USDT verification methods failed" };
}

// Main entry: scan wallet for a matching incoming payment
export async function scanWalletForPayment(
  method: CryptoMethod,
  expectedAmount: number,
  sinceTimestamp: number = 0,
  usedTxHashes: Set<string> = new Set()
): Promise<ScanResult> {
  const addr = WALLET_ADDRESSES[method];
  console.log(`[payments] Scanning ${method} wallet=${addr} expected=${expectedAmount} since=${sinceTimestamp} usedTx=${usedTxHashes.size}`);
  switch (method) {
    case "BTC": return scanBTC(addr, expectedAmount, sinceTimestamp, usedTxHashes);
    case "LTC": return scanLTC(addr, expectedAmount, sinceTimestamp, usedTxHashes);
    case "SOL": return scanSOL(addr, expectedAmount, sinceTimestamp, usedTxHashes);
    case "USDT": return scanUSDT(addr, expectedAmount, sinceTimestamp, usedTxHashes);
  }
}

// Legacy types
export type VerifyResult = ScanResult;

export async function verifyPayment(
  method: CryptoMethod,
  txHash: string,
  expectedAmount: number,
  sinceTimestamp: number = 0,
  usedTxHashes: Set<string> = new Set()
): Promise<VerifyResult> {
  void txHash;
  return scanWalletForPayment(method, expectedAmount, sinceTimestamp, usedTxHashes);
}

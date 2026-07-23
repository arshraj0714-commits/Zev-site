// Blockchain payment verification service for Zev
// Production-grade: BTC (Blockstream), LTC (LitecoinSpace), SOL (Helius RPC), USDT (BscScan API)
// All scans are time-filtered, tx-hash-deduplicated, and cached.

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

// In-memory tx cache: key = `${method}:${txHash}`, value = timestamp
// Prevents re-querying the same tx across polls
const txCache = new Map<string, number>();
const TX_CACHE_TTL = 5 * 60 * 1000; // 5 min

function isTxCached(method: string, txHash: string): boolean {
  const key = `${method}:${txHash}`;
  const cached = txCache.get(key);
  if (cached && Date.now() - cached < TX_CACHE_TTL) return true;
  return false;
}

function cacheTx(method: string, txHash: string) {
  txCache.set(`${method}:${txHash}`, Date.now());
}

// Retry wrapper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1000): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries) {
        console.error(`[payments] All retries exhausted:`, (e as Error).message);
        return null;
      }
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
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
        if (received >= expectedSatsFromValue(expectedAmount)) {
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

function expectedSatsFromValue(v: number): number {
  return Math.round(v * 1e8);
}

// ---------- SOL: Helius RPC API ----------
async function scanSOL(addr: string, expectedAmount: number, sinceTimestamp: number, usedTxHashes: Set<string>): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAddress: false,
    matchedAmount: false, amountReceived: 0, txHash: null,
    explorerUrl: `https://solscan.io/account/${addr}`,
    checkedAddress: addr, expectedAmount, confirmations: 0,
    verificationSource: "helius",
  };
  const heliusKey = process.env.HELIUS_API_KEY;
  const rpcUrl = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : "https://api.mainnet-beta.solana.com";
  try {
    // Get recent signatures
    const sigRes = await withRetry(() => fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
        params: [addr, { limit: 20 }],
      }),
    }));
    if (!sigRes?.ok) return { ...base, error: `Helius RPC error (${sigRes?.status})` };
    const sigJson = await sigRes.json();
    const sigs: any[] = sigJson?.result ?? [];
    if (!Array.isArray(sigs)) return base;

    const expectedLamports = Math.round(expectedAmount * SOL_LAMPORTS);
    const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - MAX_TX_AGE_SECONDS;

    for (const sig of sigs) {
      const signature: string = sig.signature;
      if (!signature || usedTxHashes.has(signature) || isTxCached("SOL", signature)) continue;

      const blockTime: number | undefined = sig.blockTime;
      if (typeof blockTime !== "number" || blockTime < minTime || blockTime < maxAge) continue;

      const txRes = await withRetry(() => fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getTransaction",
          params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
        }),
      }));
      if (!txRes?.ok) continue;
      const txJson = await txRes.json();
      const tx = txJson?.result;
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
          console.log(`[SOL] Payment verified: tx=${signature}, amount=${receivedLamports / SOL_LAMPORTS} SOL`);
          return base;
        }
      }
    }
    return base;
  } catch (e) {
    return { ...base, error: `SOL scan failed: ${(e as Error).message}` };
  }
}

// ---------- USDT (BEP-20): BscScan API ----------
async function scanUSDT(addr: string, expectedAmount: number, sinceTimestamp: number, usedTxHashes: Set<string>): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAddress: false,
    matchedAmount: false, amountReceived: 0, txHash: null,
    explorerUrl: `https://bscscan.com/address/${addr}`,
    checkedAddress: addr, expectedAmount, confirmations: 0,
    verificationSource: "bscscan",
  };
  const bscscanKey = process.env.BSCSCAN_API_KEY;
  if (!bscscanKey) return { ...base, error: "BSCSCAN_API_KEY not configured" };
  try {
    // Fetch recent USDT transfers to our address
    const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_BSC_CONTRACT}&address=${addr}&page=1&offset=20&sort=desc&apikey=${bscscanKey}`;
    const res = await withRetry(() => fetch(url));
    if (!res?.ok) return { ...base, error: `BscScan error (${res?.status})` };
    const data = await res.json();
    const txs: any[] = data?.result ?? [];
    if (!Array.isArray(txs)) return base;

    const expectedRaw = BigInt(Math.round(expectedAmount * 10 ** USDT_DECIMALS));
    const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - MAX_TX_AGE_SECONDS;
    const addrLower = addr.toLowerCase();

    for (const tx of txs) {
      const txHash: string = tx.hash;
      if (!txHash || usedTxHashes.has(txHash) || isTxCached("USDT", txHash)) continue;

      // Verify receiver
      const to = (tx.to || "").toLowerCase();
      if (to !== addrLower) continue;

      // Verify contract
      const contract = (tx.contractAddress || "").toLowerCase();
      if (contract !== USDT_BSC_CONTRACT.toLowerCase()) continue;

      // Parse amount (18 decimals)
      let amount: bigint;
      try { amount = BigInt(tx.value || "0"); } catch { continue; }

      // Check time via timeStamp field
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
        console.log(`[USDT] Payment verified: tx=${txHash}, amount=${base.amountReceived} USDT, confs=${confirmations}`);
        return base;
      }
    }
    return base;
  } catch (e) {
    return { ...base, error: `USDT scan failed: ${(e as Error).message}` };
  }
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

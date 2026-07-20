// Blockchain payment verification service for Zev
// Scans Arsh's wallet address for incoming transactions matching the exact
// expected amount (pending OR confirmed). Only then is a purchase delivered.
//
// IMPORTANT: Each scan is scoped to transactions that happened AFTER the order
// was created AND that haven't been used by another paid order yet. This
// prevents an old incoming transfer from paying for a new order.

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
  error?: string;
}

const SOL_LAMPORTS = 1_000_000_000;
const USDT_DECIMALS = 18;

// Tolerance window: allow transactions from up to 5 minutes BEFORE the order
// was created, to handle minor clock skew between servers and blockchains.
const TIME_TOLERANCE_SECONDS = 5 * 60;

// HARD MAXIMUM: transactions older than this are NEVER accepted, even if
// sinceTimestamp is somehow wrong. This is the safety net that prevents
// old incoming payments from paying for new orders. 30 minutes.
const MAX_TX_AGE_SECONDS = 30 * 60;

// ---------- BTC: scan address for incoming txs (mempool + recent confirmed) ----------
async function scanBTC(
  addr: string,
  expectedAmount: number,
  sinceTimestamp: number,
  usedTxHashes: Set<string>
): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    txHash: null,
    explorerUrl: `https://btcscan.org/address/${addr}`,
    checkedAddress: addr, expectedAmount,
  };
  try {
    const [memRes, confRes] = await Promise.all([
      fetch(`https://blockstream.info/api/address/${addr}/txs/mempool`),
      fetch(`https://blockstream.info/api/address/${addr}/txs`),
    ]);
    const memTxs = memRes.ok ? await memRes.json() : [];
    const confTxs = confRes.ok ? await confRes.json() : [];
    const allTxs: any[] = [...(Array.isArray(memTxs) ? memTxs : []), ...(Array.isArray(confTxs) ? confTxs : [])];

    const expectedSats = Math.round(expectedAmount * 1e8);
    const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - MAX_TX_AGE_SECONDS;

    for (const tx of allTxs) {
      const txid: string = tx.txid;
      // Skip transactions already used by another paid order
      if (txid && usedTxHashes.has(txid)) continue;

      // Time check: skip old transactions.
      // - Confirmed txs have status.block_time (unix seconds)
      // - Mempool (unconfirmed) txs are always "new" — allow them
      const blockTime: number | undefined = tx.status?.block_time;
      const isMempool = !tx.status?.confirmed;
      if (!isMempool) {
        if (typeof blockTime !== "number") continue; // can't verify age — skip
        if (blockTime < minTime) continue; // older than the order
        if (blockTime < maxAge) continue; // HARD SAFETY NET: older than 30 min
      }

      let received = 0;
      for (const vout of tx.vout ?? []) {
        if (vout.scriptpubkey_address === addr) {
          received += vout.value ?? 0;
        }
      }
      if (received > 0) {
        base.found = true;
        if (received >= expectedSats) {
          base.matchedAmount = true;
          base.amountReceived = received / 1e8;
          base.txHash = txid;
          base.confirmed = !!tx.status?.confirmed;
          base.matchedAddress = true;
          base.explorerUrl = `https://btcscan.org/tx/${txid}`;
          base.verified = true; // accept pending too
          return base;
        }
      }
    }
    return base;
  } catch (e) {
    return { ...base, error: `Bitcoin scan failed: ${(e as Error).message}` };
  }
}

// ---------- LTC: scan address for incoming txs ----------
async function scanLTC(
  addr: string,
  expectedAmount: number,
  sinceTimestamp: number,
  usedTxHashes: Set<string>
): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    txHash: null,
    explorerUrl: `https://litecoinspace.org/address/${addr}`,
    checkedAddress: addr, expectedAmount,
  };
  try {
    const addrRes = await fetch(`https://litecoinblockexplorer.net/api/v2/address/${addr}`);
    if (!addrRes.ok) return { ...base, error: `Litecoin explorer error (${addrRes.status})` };
    const addrData = await addrRes.json();
    const txids: string[] = addrData.txids ?? [];
    if (!Array.isArray(txids) || txids.length === 0) return base;

    const toCheck = txids.slice(0, 15);
    const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - MAX_TX_AGE_SECONDS;

    for (const txid of toCheck) {
      if (usedTxHashes.has(txid)) continue;
      try {
        const txRes = await fetch(`https://litecoinblockexplorer.net/api/v2/tx/${txid}`);
        if (!txRes.ok) continue;
        const tx = await txRes.json();

        // Time check: skip old transactions.
        const blockTime: number | undefined = tx.blockTime ?? tx.blocktime;
        const confirmations: number = tx.confirmations ?? 0;
        const isMempool = confirmations === 0;
        if (!isMempool) {
          if (typeof blockTime !== "number") continue; // can't verify age — skip
          if (blockTime < minTime) continue; // older than the order
          if (blockTime < maxAge) continue; // HARD SAFETY NET: older than 30 min
        }

        let received = 0;
        for (const vout of tx.vout ?? []) {
          const addrs: string[] = vout.addresses ?? [];
          if (addrs.includes(addr)) {
            received += parseFloat(vout.value ?? "0");
          }
        }
        if (received > 0) {
          base.found = true;
          if (received >= expectedAmount - 1e-8) {
            base.matchedAmount = true;
            base.amountReceived = received;
            base.txHash = tx.txid ?? txid;
            base.confirmed = confirmations > 0;
            base.matchedAddress = true;
            base.explorerUrl = `https://litecoinspace.org/tx/${base.txHash}`;
            base.verified = true;
            return base;
          }
        }
      } catch {
        /* skip this tx */
      }
    }
    return base;
  } catch (e) {
    return { ...base, error: `Litecoin scan failed: ${(e as Error).message}` };
  }
}

// ---------- SOL: scan address signatures for matching transfer ----------
async function scanSOL(
  addr: string,
  expectedAmount: number,
  sinceTimestamp: number,
  usedTxHashes: Set<string>
): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    txHash: null,
    explorerUrl: `https://solscan.io/account/${addr}`,
    checkedAddress: addr, expectedAmount,
  };
  const rpcs = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
  ];
  try {
    let sigs: any[] = [];
    let lastErr = "";
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
            params: [addr, { limit: 20 }],
          }),
        });
        if (!res.ok) { lastErr = `RPC ${res.status}`; continue; }
        const json = await res.json();
        if (Array.isArray(json?.result)) { sigs = json.result; break; }
        lastErr = json?.error?.message ?? "no result";
      } catch (e) { lastErr = (e as Error).message; }
    }

    const expectedLamports = Math.round(expectedAmount * SOL_LAMPORTS);
    const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - MAX_TX_AGE_SECONDS;

    console.log("[SOL scan] order since:", sinceTimestamp, "| minTime:", minTime, "| maxAge:", maxAge, "| sigs:", sigs.length);

    for (const sig of sigs) {
      const signature: string = sig.signature;
      if (!signature) continue;

      // Skip transactions already used by another paid order
      if (usedTxHashes.has(signature)) {
        console.log("[SOL scan] skipping used tx:", signature.slice(0, 20));
        continue;
      }

      // Time check — STRICT. The transaction's blockTime MUST be:
      //   1. A valid number (not null/undefined)
      //   2. >= minTime (within 5 min before the order was created)
      //   3. >= maxAge (not older than 30 minutes from now — hard safety net)
      const blockTime: number | undefined = sig.blockTime;
      console.log("[SOL scan] tx:", signature.slice(0, 20), "| blockTime:", blockTime, "| age:", blockTime ? `${Math.round((now - blockTime) / 60)}min` : "null");

      if (typeof blockTime !== "number") {
        // No blockTime — can't verify age, skip for safety
        continue;
      }
      if (blockTime < minTime) {
        // Older than the order — definitely not the buyer's payment
        continue;
      }
      if (blockTime < maxAge) {
        // HARD SAFETY NET: older than 30 minutes from now — skip
        continue;
      }

      let tx: any = null;
      for (const rpc of rpcs) {
        try {
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1, method: "getTransaction",
              params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
            }),
          });
          if (!res.ok) continue;
          const json = await res.json();
          if (json?.result) { tx = json.result; break; }
        } catch { /* try next rpc */ }
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
        const postNative: number[] = tx.meta?.postBalances ?? [];
        const preNative: number[] = tx.meta?.preBalances ?? [];
        const accountKeys: string[] = tx.transaction?.message?.accountKeys?.map((k: any) =>
          typeof k === "string" ? k : k.pubkey
        ) ?? [];
        for (let i = 0; i < accountKeys.length; i++) {
          if (accountKeys[i] === addr) {
            const delta = (postNative[i] ?? 0) - (preNative[i] ?? 0);
            if (delta > 0) {
              matched = true;
              receivedLamports += delta;
            }
          }
        }
      }
      if (matched) {
        base.found = true;
        if (receivedLamports >= expectedLamports) {
          base.matchedAmount = true;
          base.amountReceived = receivedLamports / SOL_LAMPORTS;
          base.txHash = signature;
          base.confirmed = !sig.err;
          base.matchedAddress = true;
          base.explorerUrl = `https://solscan.io/tx/${signature}`;
          base.verified = true;
          return base;
        }
      }
    }
    if (!base.found && lastErr) base.error = `Solana scan: ${lastErr}`;
    return base;
  } catch (e) {
    return { ...base, error: `Solana scan failed: ${(e as Error).message}` };
  }
}

// ---------- USDT (BEP20): scan Transfer logs to our address ----------
async function scanUSDT(
  addr: string,
  expectedAmount: number,
  sinceTimestamp: number,
  usedTxHashes: Set<string>
): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    txHash: null,
    explorerUrl: `https://bscscan.com/address/${addr}`,
    checkedAddress: addr, expectedAmount,
  };
  const rpcs = [
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.binance.org",
    "https://bsc.publicnode.com",
  ];
  try {
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const toTopic = "0x000000000000000000000000" + addr.toLowerCase().slice(2);
    const expectedRaw = BigInt(Math.round(expectedAmount * 10 ** USDT_DECIMALS));

    for (const rpc of rpcs) {
      try {
        const blockRes = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        });
        if (!blockRes.ok) continue;
        const blockJson = await blockRes.json();
        const latest = parseInt(blockJson.result ?? "0x0", 16);
        // Look back ~5000 blocks (~4 hours) — enough to catch a recent payment
        const fromBlock = "0x" + Math.max(0, latest - 5000).toString(16);

        const logsRes = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "eth_getLogs",
            params: [{
              address: USDT_BSC_CONTRACT,
              topics: [transferTopic, null, toTopic],
              fromBlock,
              toBlock: "latest",
            }],
          }),
        });
        if (!logsRes.ok) continue;
        const logsJson = await logsRes.json();
        const logs: any[] = logsJson?.result ?? [];
        if (!Array.isArray(logs)) continue;

        // Sort logs newest-first so we check the most recent payment first
        const sortedLogs = [...logs].sort((a, b) => {
          try { return parseInt(b.blockNumber ?? "0x0", 16) - parseInt(a.blockNumber ?? "0x0", 16); }
          catch { return 0; }
        });

        for (const log of sortedLogs) {
          const txHash: string = log.transactionHash;
          if (txHash && usedTxHashes.has(txHash)) continue;

          // Time check: fetch the block timestamp for this log's block
          // and skip it if the block is older than the order.
          let blockAgeOk = false;
          try {
            const blkRes = await fetch(rpc, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber",
                params: [log.blockNumber, false],
              }),
            });
            if (blkRes.ok) {
              const blkJson = await blkRes.json();
              const blockTimestamp: number | undefined = blkJson?.result?.timestamp
                ? parseInt(blkJson.result.timestamp, 16)
                : undefined;
              if (typeof blockTimestamp === "number") {
                const minTime = sinceTimestamp - TIME_TOLERANCE_SECONDS;
                const maxAge = (Math.floor(Date.now() / 1000)) - MAX_TX_AGE_SECONDS;
                if (blockTimestamp < minTime) continue; // older than the order
                if (blockTimestamp < maxAge) continue; // HARD SAFETY NET: older than 30 min
                blockAgeOk = true;
              }
            }
          } catch {
            // if we can't fetch the block, skip this log for safety
            continue;
          }
          if (!blockAgeOk) continue; // couldn't verify age — skip for safety

          let amount: bigint;
          try { amount = BigInt(log.data ?? "0x0"); } catch { continue; }
          base.found = true;
          if (amount >= expectedRaw) {
            base.matchedAmount = true;
            base.amountReceived = Number(amount) / 10 ** USDT_DECIMALS;
            base.txHash = txHash;
            base.confirmed = true;
            base.matchedAddress = true;
            base.explorerUrl = `https://bscscan.com/tx/${txHash}`;
            base.verified = true;
            return base;
          }
        }
        return base;
      } catch {
        // try next rpc
      }
    }
    return { ...base, error: "Could not reach BSC RPC to scan for payments." };
  } catch (e) {
    return { ...base, error: `USDT scan failed: ${(e as Error).message}` };
  }
}

// Main entry: scan Arsh's wallet for a matching incoming payment.
//   - sinceTimestamp: unix seconds — only consider txs after this time
//   - usedTxHashes: set of tx hashes already used by other paid orders
export async function scanWalletForPayment(
  method: CryptoMethod,
  expectedAmount: number,
  sinceTimestamp: number = 0,
  usedTxHashes: Set<string> = new Set()
): Promise<ScanResult> {
  const addr = WALLET_ADDRESSES[method];
  switch (method) {
    case "BTC": return scanBTC(addr, expectedAmount, sinceTimestamp, usedTxHashes);
    case "LTC": return scanLTC(addr, expectedAmount, sinceTimestamp, usedTxHashes);
    case "SOL": return scanSOL(addr, expectedAmount, sinceTimestamp, usedTxHashes);
    case "USDT": return scanUSDT(addr, expectedAmount, sinceTimestamp, usedTxHashes);
  }
}

// Legacy tx-hash verification (kept for the /api/verify-payment route)
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

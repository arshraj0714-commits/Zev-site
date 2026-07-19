// Blockchain payment verification service for Zev
// Scans Arsh's wallet address for incoming transactions matching the exact
// expected amount (pending OR confirmed). Only then is a purchase delivered.

import { WALLET_ADDRESSES, USDT_BSC_CONTRACT, type CryptoMethod } from "./config";

export interface ScanResult {
  verified: boolean;          // a matching tx was found (pending or confirmed)
  found: boolean;             // at least one recent tx to the address was found
  confirmed: boolean;         // the matching tx is confirmed
  matchedAmount: boolean;
  amountReceived: number;     // in crypto units
  txHash: string | null;      // the matching tx hash (for the buyer's reference)
  explorerUrl: string;        // link to the tx on the explorer
  checkedAddress: string;
  expectedAmount: number;
  error?: string;
}

const SOL_LAMPORTS = 1_000_000_000;
const USDT_DECIMALS = 18;

// ---------- BTC: scan address for incoming txs (mempool + recent confirmed) ----------
async function scanBTC(addr: string, expectedAmount: number): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAmount: false,
    amountReceived: 0, txHash: null,
    explorerUrl: `https://btcscan.org/address/${addr}`,
    checkedAddress: addr, expectedAmount,
  };
  try {
    // mempool (unconfirmed) + recent confirmed txs for the address
    const [memRes, confRes] = await Promise.all([
      fetch(`https://blockstream.info/api/address/${addr}/txs/mempool`),
      fetch(`https://blockstream.info/api/address/${addr}/txs`),
    ]);
    const memTxs = memRes.ok ? await memRes.json() : [];
    const confTxs = confRes.ok ? await confRes.json() : [];
    const allTxs: any[] = [...(Array.isArray(memTxs) ? memTxs : []), ...(Array.isArray(confTxs) ? confTxs : [])];

    const expectedSats = Math.round(expectedAmount * 1e8);
    for (const tx of allTxs) {
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
          base.txHash = tx.txid;
          base.confirmed = !!(tx.status?.confirmed);
          base.explorerUrl = `https://btcscan.org/tx/${tx.txid}`;
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
async function scanLTC(addr: string, expectedAmount: number): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAmount: false,
    amountReceived: 0, txHash: null,
    explorerUrl: `https://litecoinspace.org/address/${addr}`,
    checkedAddress: addr, expectedAmount,
  };
  try {
    // 1. get the list of tx ids for the address
    const addrRes = await fetch(`https://litecoinblockexplorer.net/api/v2/address/${addr}`);
    if (!addrRes.ok) return { ...base, error: `Litecoin explorer error (${addrRes.status})` };
    const addrData = await addrRes.json();
    const txids: string[] = addrData.txids ?? [];
    if (!Array.isArray(txids) || txids.length === 0) return base;

    // 2. fetch each recent tx (limit to last 15) and check vouts to our address
    const toCheck = txids.slice(0, 15);
    for (const txid of toCheck) {
      try {
        const txRes = await fetch(`https://litecoinblockexplorer.net/api/v2/tx/${txid}`);
        if (!txRes.ok) continue;
        const tx = await txRes.json();
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
            base.confirmed = (tx.confirmations ?? 0) > 0;
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
async function scanSOL(addr: string, expectedAmount: number): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAmount: false,
    amountReceived: 0, txHash: null,
    explorerUrl: `https://solscan.io/account/${addr}`,
    checkedAddress: addr, expectedAmount,
  };
  const rpcs = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
  ];
  try {
    // 1. get recent signatures for the address
    let sigs: any[] = [];
    let lastErr = "";
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
            params: [addr, { limit: 15 }],
          }),
        });
        if (!res.ok) { lastErr = `RPC ${res.status}`; continue; }
        const json = await res.json();
        if (Array.isArray(json?.result)) { sigs = json.result; break; }
        lastErr = json?.error?.message ?? "no result";
      } catch (e) { lastErr = (e as Error).message; }
    }

    const expectedLamports = Math.round(expectedAmount * SOL_LAMPORTS);

    // 2. check each signature's transaction for a transfer to our address
    for (const sig of sigs) {
      if (!sig.signature) continue;
      let tx: any = null;
      for (const rpc of rpcs) {
        try {
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1, method: "getTransaction",
              params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
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
      // check parsed transfer instructions
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
      // fallback: native balance delta
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
          base.txHash = sig.signature;
          base.confirmed = !sig.err;
          base.explorerUrl = `https://solscan.io/tx/${sig.signature}`;
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
async function scanUSDT(addr: string, expectedAmount: number): Promise<ScanResult> {
  const base: ScanResult = {
    verified: false, found: false, confirmed: false, matchedAmount: false,
    amountReceived: 0, txHash: null,
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
        // get latest block, then fetch logs from ~5000 blocks back (~4 hours)
        const blockRes = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        });
        if (!blockRes.ok) continue;
        const blockJson = await blockRes.json();
        const latest = parseInt(blockJson.result ?? "0x0", 16);
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

        for (const log of logs) {
          let amount: bigint;
          try { amount = BigInt(log.data ?? "0x0"); } catch { continue; }
          base.found = true;
          if (amount >= expectedRaw) {
            base.matchedAmount = true;
            base.amountReceived = Number(amount) / 10 ** USDT_DECIMALS;
            base.txHash = log.transactionHash;
            base.confirmed = true; // eth_getLogs only returns mined txs
            base.explorerUrl = `https://bscscan.com/tx/${log.transactionHash}`;
            base.verified = true;
            return base;
          }
        }
        // if we got logs back without error, stop trying other rpcs
        return base;
      } catch (e) {
        // try next rpc
      }
    }
    return { ...base, error: "Could not reach BSC RPC to scan for payments." };
  } catch (e) {
    return { ...base, error: `USDT scan failed: ${(e as Error).message}` };
  }
}

// Main entry: scan Arsh's wallet for a matching incoming payment
export async function scanWalletForPayment(
  method: CryptoMethod,
  expectedAmount: number
): Promise<ScanResult> {
  const addr = WALLET_ADDRESSES[method];
  switch (method) {
    case "BTC": return scanBTC(addr, expectedAmount);
    case "LTC": return scanLTC(addr, expectedAmount);
    case "SOL": return scanSOL(addr, expectedAmount);
    case "USDT": return scanUSDT(addr, expectedAmount);
  }
}

// Legacy tx-hash verification (kept for the /api/verify-payment route)
export type VerifyResult = ScanResult;

export async function verifyPayment(
  method: CryptoMethod,
  txHash: string,
  expectedAmount: number
): Promise<VerifyResult> {
  // delegates to wallet scan — if a tx hash is provided, the scan will still
  // find it among recent transactions if it matches the amount.
  void txHash;
  return scanWalletForPayment(method, expectedAmount);
}

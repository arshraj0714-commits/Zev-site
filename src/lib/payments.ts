// Blockchain payment verification service for Zev
// Verifies real on-chain transactions for BTC / LTC / SOL / USDT(BEP20)
// Uses free public APIs (no API key required).

import { WALLET_ADDRESSES, USDT_BSC_CONTRACT, type CryptoMethod } from "./config";

export interface VerifyResult {
  verified: boolean;
  found: boolean;
  confirmed: boolean;
  matchedAddress: boolean;
  matchedAmount: boolean;
  amountReceived: number; // in crypto units (BTC/LTC/SOL/USDT)
  explorerUrl: string;
  error?: string;
}

const SOL_LAMPORTS = 1_000_000_000; // 1 SOL = 1e9 lamports
const USDT_DECIMALS = 18; // USDT on BSC has 18 decimals

// ---------- BTC verification (blockstream.info) ----------
async function verifyBTC(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  const base: VerifyResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    explorerUrl: `https://btcscan.org/tx/${txHash}`,
  };
  try {
    const res = await fetch(`https://blockstream.info/api/tx/${txHash}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { ...base, error: "Transaction not found on Bitcoin network." };
    if (!res.ok) return { ...base, error: `Bitcoin explorer error (${res.status}).` };
    const data = await res.json();
    base.found = true;
    base.confirmed = !!data?.status?.confirmed;
    const expectedSats = Math.round(expectedAmount * 1e8);
    let received = 0;
    let matchedAddr = false;
    for (const vout of data.vout ?? []) {
      const addr = vout.scriptpubkey_address;
      if (addr && addr === expectedAddress) {
        matchedAddr = true;
        received += vout.value ?? 0;
      }
    }
    base.matchedAddress = matchedAddr;
    base.amountReceived = received / 1e8;
    base.matchedAmount = received >= expectedSats;
    base.verified = base.confirmed && matchedAddr && base.matchedAmount;
    return base;
  } catch (e) {
    return { ...base, error: `Bitcoin verification failed: ${(e as Error).message}` };
  }
}

// ---------- LTC verification (litecoinblockexplorer.net) ----------
async function verifyLTC(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  const base: VerifyResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    explorerUrl: `https://litecoinspace.org/tx/${txHash}`,
  };
  try {
    const res = await fetch(`https://litecoinblockexplorer.net/api/v2/tx/${txHash}`);
    if (res.status === 404) return { ...base, error: "Transaction not found on Litecoin network." };
    if (!res.ok) return { ...base, error: `Litecoin explorer error (${res.status}).` };
    const data = await res.json();
    base.found = true;
    base.confirmed = data?.confirmations ? data.confirmations > 0 : true;
    let received = 0;
    let matchedAddr = false;
    for (const vout of data.vout ?? []) {
      const addrs: string[] = vout.addresses ?? [];
      if (addrs.includes(expectedAddress)) {
        matchedAddr = true;
        received += parseFloat(vout.value ?? "0");
      }
    }
    base.matchedAddress = matchedAddr;
    base.amountReceived = received;
    base.matchedAmount = received >= expectedAmount - 1e-8;
    base.verified = base.confirmed && matchedAddr && base.matchedAmount;
    return base;
  } catch (e) {
    return { ...base, error: `Litecoin verification failed: ${(e as Error).message}` };
  }
}

// ---------- SOL verification (Solana RPC) ----------
async function verifySOL(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  const base: VerifyResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    explorerUrl: `https://solscan.io/tx/${txHash}`,
  };
  try {
    const rpcs = [
      "https://api.mainnet-beta.solana.com",
      "https://solana-rpc.publicnode.com",
    ];
    let data: any = null;
    let lastErr = "";
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getTransaction",
            params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
        });
        if (!res.ok) { lastErr = `RPC ${res.status}`; continue; }
        const json = await res.json();
        if (json?.result) { data = json.result; break; }
        lastErr = json?.error?.message ?? "not found";
      } catch (e) { lastErr = (e as Error).message; }
    }
    if (!data) return { ...base, error: `Solana transaction not found. ${lastErr}` };
    base.found = true;
    base.confirmed = true; // getTransaction only returns confirmed txs
    const expectedLamports = Math.round(expectedAmount * SOL_LAMPORTS);
    let receivedLamports = 0;
    let matchedAddr = false;
    const instructions = data?.transaction?.message?.instructions ?? [];
    const innerInstructions = data?.meta?.innerInstructions ?? [];
    const allInstr = [...instructions, ...innerInstructions.flatMap((i: any) => i.instructions ?? [])];
    for (const ix of allInstr) {
      const parsed = ix?.parsed;
      if (parsed?.type === "transfer" && parsed.info) {
        const dest = parsed.info.destination;
        const lamports = parsed.info.lamports ?? 0;
        if (dest && dest === expectedAddress) {
          matchedAddr = true;
          receivedLamports += lamports;
        }
      }
    }
    // Also check pre/post token balances for any native SOL balance changes (fallback)
    if (!matchedAddr) {
      const postBalances: number[] = data?.meta?.postTokenBalances ?? [];
      const preBalances: number[] = data?.meta?.preTokenBalances ?? [];
      // native balances
      const postNative: number[] = data?.meta?.postBalances ?? [];
      const preNative: number[] = data?.meta?.preBalances ?? [];
      const accountKeys: string[] = data?.transaction?.message?.accountKeys?.map((k: any) => (typeof k === "string" ? k : k.pubkey)) ?? [];
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys[i] === expectedAddress) {
          const post = postNative[i] ?? 0;
          const pre = preNative[i] ?? 0;
          const delta = post - pre;
          if (delta > 0) {
            matchedAddr = true;
            receivedLamports += delta;
          }
        }
      }
      void postBalances; void preBalances;
    }
    base.matchedAddress = matchedAddr;
    base.amountReceived = receivedLamports / SOL_LAMPORTS;
    base.matchedAmount = receivedLamports >= expectedLamports;
    base.verified = base.confirmed && matchedAddr && base.matchedAmount;
    return base;
  } catch (e) {
    return { ...base, error: `Solana verification failed: ${(e as Error).message}` };
  }
}

// ---------- USDT (BEP20) verification (BSC RPC) ----------
async function verifyUSDT(txHash: string, expectedAddress: string, expectedAmount: number): Promise<VerifyResult> {
  const base: VerifyResult = {
    verified: false, found: false, confirmed: false,
    matchedAddress: false, matchedAmount: false, amountReceived: 0,
    explorerUrl: `https://bscscan.com/tx/${txHash}`,
  };
  try {
    const rpcs = [
      "https://bsc-dataseed.binance.org",
      "https://bsc-dataseed1.binance.org",
      "https://bsc.publicnode.com",
    ];
    let receipt: any = null;
    let lastErr = "";
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt",
            params: [txHash],
          }),
        });
        if (!res.ok) { lastErr = `RPC ${res.status}`; continue; }
        const json = await res.json();
        if (json?.result) { receipt = json.result; break; }
        lastErr = json?.error?.message ?? "no result";
      } catch (e) { lastErr = (e as Error).message; }
    }
    if (!receipt) return { ...base, error: `BSC transaction not found. ${lastErr}` };
    base.found = true;
    base.confirmed = receipt.status === "0x1";
    const expectedRaw = BigInt(Math.round(expectedAmount * 10 ** USDT_DECIMALS));
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const expectedAddrLower = expectedAddress.toLowerCase();
    let receivedRaw = 0n;
    let matchedAddr = false;
    for (const log of receipt.logs ?? []) {
      const addr = (log.address ?? "").toLowerCase();
      if (addr !== USDT_BSC_CONTRACT.toLowerCase()) continue;
      const topics: string[] = log.topics ?? [];
      if (topics[0]?.toLowerCase() !== transferTopic) continue;
      // topics[2] is the 'to' address padded to 32 bytes
      const toTopic = topics[2] ?? "";
      const toAddr = "0x" + toTopic.slice(-40);
      if (toAddr.toLowerCase() === expectedAddrLower) {
        matchedAddr = true;
        try { receivedRaw += BigInt(log.data ?? "0x0"); } catch { /* ignore */ }
      }
    }
    base.matchedAddress = matchedAddr;
    base.amountReceived = Number(receivedRaw) / 10 ** USDT_DECIMALS;
    base.matchedAmount = receivedRaw >= expectedRaw;
    base.verified = base.confirmed && matchedAddr && base.matchedAmount;
    return base;
  } catch (e) {
    return { ...base, error: `USDT verification failed: ${(e as Error).message}` };
  }
}

export async function verifyPayment(
  method: CryptoMethod,
  txHash: string,
  expectedAmount: number
): Promise<VerifyResult> {
  const tx = txHash.trim();
  const addr = WALLET_ADDRESSES[method];
  switch (method) {
    case "BTC": return verifyBTC(tx, addr, expectedAmount);
    case "LTC": return verifyLTC(tx, addr, expectedAmount);
    case "SOL": return verifySOL(tx, addr, expectedAmount);
    case "USDT": return verifyUSDT(tx, addr, expectedAmount);
  }
}

import { NextResponse } from "next/server";
import { getCryptoPrices, PAYMENT_METHODS, WALLET_ADDRESSES } from "@/lib/config";

export async function GET() {
  try {
    const prices = await getCryptoPrices();
    return NextResponse.json({
      prices,
      methods: PAYMENT_METHODS.map((m) => ({
        ...m,
        address: WALLET_ADDRESSES[m.id],
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

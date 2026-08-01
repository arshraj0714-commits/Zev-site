import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const stats = await db.siteStats.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", vouches: 1000, productsSold: 1573 },
    });
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { vouches, productsSold } = await req.json();
    const data: { vouches?: number; productsSold?: number } = {};
    if (typeof vouches === "number") data.vouches = vouches;
    if (typeof productsSold === "number") data.productsSold = productsSold;
    const stats = await db.siteStats.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", vouches: vouches ?? 1000, productsSold: productsSold ?? 1573 },
    });
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

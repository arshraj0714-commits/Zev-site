import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifyToken, hashPassword, verifyPassword } from "@/lib/auth";

// POST /api/auth/update-profile — update name only (email cannot be changed)
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const user = verifyToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { name } = await req.json();
    if (!name || name.trim().length < 1) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: name.trim() },
    });

    return NextResponse.json({
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
      message: "Profile updated successfully!",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

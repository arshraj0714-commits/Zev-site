// Auth helper for Zev — email/password signup + login system
// Owner/admin: Arsh (arsh.raj.0713@gmail.com) gets auto-admin on signup.
import crypto from "crypto";
import { db } from "./db";
import { ADMIN_CREDENTIALS } from "./config";

const TOKEN_SECRET = "zev-admin-secret-2024";
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface AppUser {
  id?: string;
  email: string;
  name: string;
  role: string; // "user" | "admin"
}

// ---- Password hashing (scrypt, built-in, no deps) ----
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = crypto.scryptSync(password, salt, 64).toString("hex");
  // constant-time compare
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verify, "hex"));
}

// ---- Admin detection ----
// Any signup/login with the owner email is automatically granted admin.
export function isAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase();
}

// ---- Token (signed) ----
export function createToken(user: AppUser): string {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + TOKEN_TTL,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string | null | undefined): AppUser | null {
  if (!token) return null;
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// ---- DB helpers ----
export async function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

export async function createUser(email: string, password: string, name?: string) {
  const role = isAdminEmail(email) ? "admin" : "user";
  return db.user.create({
    data: {
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      name: name || email.split("@")[0],
      role,
    },
  });
}

export function toAppUser(u: { id: string; email: string; name: string | null; role: string }): AppUser {
  return { id: u.id, email: u.email, name: u.name || u.email.split("@")[0], role: u.role };
}

// Simple auth helper for Zev admin (owner: Arsh)
// Issues a lightweight signed token (not JWT, but sufficient for this app).
import { ADMIN_CREDENTIALS } from "./config";

const TOKEN_SECRET = "zev-admin-secret-2024";
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface AdminUser {
  email: string;
  name: string;
  role: string;
}

export const ADMIN_USER: AdminUser = {
  email: ADMIN_CREDENTIALS.email,
  name: ADMIN_CREDENTIALS.name,
  role: ADMIN_CREDENTIALS.role,
};

export function verifyCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() &&
    password === ADMIN_CREDENTIALS.password
  );
}

export function createToken(user: AdminUser): string {
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + TOKEN_TTL,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = Buffer.from(`${body}.${TOKEN_SECRET}`).toString("base64url").slice(0, 32);
  return `${body}.${sig}`;
}

export function verifyToken(token: string | null | undefined): AdminUser | null {
  if (!token) return null;
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expectedSig = Buffer.from(`${body}.${TOKEN_SECRET}`).toString("base64url").slice(0, 32);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (payload.email?.toLowerCase() !== ADMIN_CREDENTIALS.email.toLowerCase()) return null;
    return { email: payload.email, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

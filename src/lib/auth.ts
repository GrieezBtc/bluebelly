import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { unauthorized } from "@/lib/api";

export const SESSION_COOKIE = "bemblo_session";
const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export async function createSession(userId: number, platform = "web") {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, platform, expiresAt });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

/** Reads the raw session token from the Authorization header (native apps) or the cookie (web). */
export async function readToken(request?: Request): Promise<string | null> {
  const header = request?.headers.get("authorization") ?? request?.headers.get("Authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export type AuthUser = typeof users.$inferSelect;

export async function getCurrentUser(request?: Request): Promise<AuthUser | null> {
  const token = await readToken(request);
  if (!token) return null;
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    return null;
  }
  return row.user;
}

export async function requireUser(request?: Request): Promise<AuthUser> {
  const user = await getCurrentUser(request);
  if (!user) throw unauthorized();
  return user;
}

export async function requireVerifiedUser(request?: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (!user.emailVerifiedAt) {
    const { forbidden } = await import("@/lib/api");
    throw forbidden(
      "Please verify your email address before using Bemblo.",
      "email_not_verified",
    );
  }
  return user;
}

export function publicBaseUrl(request?: Request) {
  const envUrl = process.env.BEMBLO_PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("BEMBLO_PUBLIC_URL must be configured in production.");
  }
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  return "";
}

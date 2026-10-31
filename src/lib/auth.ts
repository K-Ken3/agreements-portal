import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(nodeScrypt);
export const SESSION_COOKIE = "agreements_session";
const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;

export type AuthenticatedUser = {
  id: string;
  legalName: string;
  email: string;
  locale: string;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = storedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !saltHex ||
    !keyHex ||
    !/^[a-f0-9]{32}$/i.test(saltHex) ||
    !/^[a-f0-9]{128}$/i.test(keyHex)
  ) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashSessionToken(token: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
}

export async function createSession(userId: string, response: NextResponse): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt }
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession(request: NextRequest, response: NextResponse): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true }
  });
  if (!session) return null;
  if (session.expiresAt <= new Date() || session.user.accountStatus !== "ACTIVE") {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return {
    id: session.user.id,
    legalName: session.user.legalName,
    email: session.user.email,
    locale: session.user.locale
  };
}

export function rejectCrossOriginMutation(request: NextRequest): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    if (new URL(origin).origin !== request.nextUrl.origin) {
      return Response.json({ error: "Cross-origin request rejected." }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

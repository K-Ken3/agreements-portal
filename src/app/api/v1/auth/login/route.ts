import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  hashPassword,
  rejectCrossOriginMutation,
  verifyPassword
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { normalizedEmail: email } });
  let passwordIsValid = false;
  if (user) {
    passwordIsValid = await verifyPassword(parsed.data.password, user.passwordHash);
  } else {
    await hashPassword(parsed.data.password);
  }
  if (!passwordIsValid || !user || user.accountStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({
    user: { id: user.id, legalName: user.legalName, email: user.email, locale: user.locale }
  });
  await createSession(user.id, response);
  return response;
}

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword, rejectCrossOriginMutation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
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
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a name, valid email, and password with at least 12 characters." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  try {
    const user = await prisma.user.create({
      data: {
        legalName: parsed.data.legalName,
        email,
        normalizedEmail: email,
        passwordHash: await hashPassword(parsed.data.password)
      },
      select: { id: true, legalName: true, email: true, locale: true }
    });

    const response = NextResponse.json({ user }, { status: 201 });
    await createSession(user.id, response);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "We could not create an account with those details." },
        { status: 400 }
      );
    }
    console.error("Registration failed.");
    return NextResponse.json({ error: "Unable to create your account right now." }, { status: 500 });
  }
}

import { AgreementSignerRole, AgreementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginMutation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashSigningSecret, matchesSigningSecret, createSigningToken } from "@/lib/signing";

const verifySchema = z.object({
  token: z.string().min(32).max(128),
  code: z.string().regex(/^\d{6}$/).optional()
});

const SIGNING_SESSION_COOKIE = "agreement_signing_session";
const SIGNING_SESSION_MS = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length < 32 || token.length > 128) {
    return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });
  }

  const signer = await prisma.agreementSigner.findUnique({
    where: { invitationTokenHash: hashSigningSecret("invitation", token) },
    select: {
      role: true,
      emailVerificationRequired: true,
      invitationSentAt: true,
      invitationExpiresAt: true,
      signedAt: true,
      agreement: {
        select: {
          status: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { isLocked: true } }
        }
      }
    }
  });
  const now = new Date();
  if (
    !signer ||
    signer.role !== AgreementSignerRole.COUNTERPARTY ||
    !signer.invitationSentAt ||
    !signer.invitationExpiresAt ||
    signer.invitationExpiresAt <= now ||
    signer.signedAt ||
    (signer.agreement.status !== AgreementStatus.LOCKED_FOR_SIGNING &&
      signer.agreement.status !== AgreementStatus.PARTIALLY_SIGNED) ||
    !signer.agreement.versions[0]?.isLocked
  ) {
    return NextResponse.json({ error: "This signing invitation has expired or is no longer active." }, { status: 410 });
  }
  return NextResponse.json({ emailVerificationRequired: signer.emailVerificationRequired });
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the six-digit code from your invitation email." }, { status: 400 });
  }

  const signer = await prisma.agreementSigner.findUnique({
    where: { invitationTokenHash: hashSigningSecret("invitation", parsed.data.token) },
    include: {
      agreement: {
        include: {
          issuer: { select: { legalName: true, email: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          signers: { select: { role: true, signedName: true, signedAt: true } }
        }
      }
    }
  });
  const now = new Date();
  const version = signer?.agreement.versions[0];
  if (signer?.emailVerificationRequired && !parsed.data.code) {
    return NextResponse.json({ error: "Enter the six-digit code from your invitation email." }, { status: 400 });
  }
  if (
    !signer ||
    signer.role !== AgreementSignerRole.COUNTERPARTY ||
    !signer.invitationSentAt ||
    !signer.invitationExpiresAt ||
    signer.invitationExpiresAt <= now ||
    signer.agreement.status !== AgreementStatus.LOCKED_FOR_SIGNING &&
      signer.agreement.status !== AgreementStatus.PARTIALLY_SIGNED ||
    signer.signedAt ||
    !version?.isLocked ||
    (signer.emailVerificationRequired &&
      (!signer.otpHash ||
        !signer.otpExpiresAt ||
        signer.otpExpiresAt <= now ||
        signer.otpAttempts >= 5))
  ) {
    return NextResponse.json({ error: "This invitation or verification code has expired." }, { status: 410 });
  }

  if (
    signer.emailVerificationRequired &&
    parsed.data.code &&
    signer.otpHash &&
    !matchesSigningSecret("otp", parsed.data.code, signer.otpHash)
  ) {
    await prisma.agreementSigner.updateMany({
      where: { id: signer.id, otpAttempts: signer.otpAttempts, signedAt: null },
      data: { otpAttempts: { increment: 1 } }
    });
    return NextResponse.json({ error: "That verification code is not valid." }, { status: 400 });
  }

  const signingSession = createSigningToken();
  const sessionExpiresAt = new Date(now.getTime() + SIGNING_SESSION_MS);
  const claimed = await prisma.agreementSigner.updateMany({
    where: {
      id: signer.id,
      signedAt: null,
      invitationExpiresAt: { gt: now },
      ...(signer.emailVerificationRequired
        ? { otpHash: signer.otpHash, otpAttempts: { lt: 5 } }
        : {})
    },
    data: {
      otpHash: signer.emailVerificationRequired ? null : undefined,
      otpExpiresAt: signer.emailVerificationRequired ? null : undefined,
      verifiedAt: signer.emailVerificationRequired ? now : undefined,
      sessionTokenHash: hashSigningSecret("session", signingSession),
      sessionExpiresAt
    }
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: "This verification code has already been used." }, { status: 409 });
  }

  const response = NextResponse.json({
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      signedAt: signer.signedAt,
      emailVerificationRequired: signer.emailVerificationRequired
    },
    agreement: {
      id: signer.agreement.id,
      status: signer.agreement.status,
      publicReference: signer.agreement.publicReference,
      title: signer.agreement.title,
      category: signer.agreement.category,
      issuer: signer.agreement.issuer,
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      canonicalContent: version.canonicalContent,
      signatures: signer.agreement.signers
    }
  });
  response.cookies.set(SIGNING_SESSION_COOKIE, signingSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/signatures",
    expires: sessionExpiresAt
  });
  return response;
}

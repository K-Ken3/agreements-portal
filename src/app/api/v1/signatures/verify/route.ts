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
  const completedAgreementAccess = Boolean(
    signer?.signedAt && signer.agreement.status === AgreementStatus.FINALIZED
  );
  if (!parsed.data.code) {
    return NextResponse.json({ error: "Enter the six-digit code from your invitation email." }, { status: 400 });
  }
  if (
    !signer ||
    signer.role !== AgreementSignerRole.COUNTERPARTY ||
    !signer.invitationSentAt ||
    (!completedAgreementAccess &&
      (!signer.invitationExpiresAt ||
        signer.invitationExpiresAt <= now ||
        signer.agreement.status !== AgreementStatus.LOCKED_FOR_SIGNING &&
          signer.agreement.status !== AgreementStatus.PARTIALLY_SIGNED ||
        signer.signedAt)) ||
    !version?.isLocked ||
    !signer.otpHash ||
    !signer.otpExpiresAt ||
    signer.otpExpiresAt <= now ||
    signer.otpAttempts >= 5
  ) {
    return NextResponse.json({ error: "This invitation or verification code has expired." }, { status: 410 });
  }

  if (!matchesSigningSecret("otp", parsed.data.code, signer.otpHash)) {
    await prisma.agreementSigner.updateMany({
      where: {
        id: signer.id,
        otpAttempts: signer.otpAttempts,
        ...(completedAgreementAccess ? { signedAt: signer.signedAt } : { signedAt: null })
      },
      data: { otpAttempts: { increment: 1 } }
    });
    return NextResponse.json({ error: "That verification code is not valid." }, { status: 400 });
  }

  const signingSession = createSigningToken();
  const sessionExpiresAt = new Date(now.getTime() + SIGNING_SESSION_MS);
  const claimed = await prisma.agreementSigner.updateMany({
    where: {
      id: signer.id,
      otpHash: signer.otpHash,
      otpAttempts: { lt: 5 },
      ...(completedAgreementAccess
        ? { signedAt: signer.signedAt }
        : { signedAt: null, invitationExpiresAt: { gt: now } })
    },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      verifiedAt: now,
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
      signedAt: signer.signedAt
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

import { AgreementSignerRole, AgreementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginMutation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createSigningCode,
  hashSigningSecret,
  isEmailDeliveryConfigured,
  sendSigningInvitation
} from "@/lib/signing";

const resendSchema = z.object({ token: z.string().min(32).max(128) });

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  if (!isEmailDeliveryConfigured()) {
    return NextResponse.json({ error: "Email delivery is not configured." }, { status: 503 });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = resendSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });

  const signer = await prisma.agreementSigner.findUnique({
    where: { invitationTokenHash: hashSigningSecret("invitation", parsed.data.token) },
    include: { agreement: { include: { issuer: { select: { legalName: true } } } } }
  });
  const now = new Date();
  const completedAgreementAccess = Boolean(
    signer?.signedAt && signer.agreement.status === AgreementStatus.FINALIZED
  );
  if (
    !signer ||
    signer.role !== AgreementSignerRole.COUNTERPARTY ||
    !signer.invitationSentAt ||
    (!completedAgreementAccess &&
      (!signer.invitationExpiresAt ||
        signer.invitationExpiresAt <= now ||
        signer.signedAt ||
        signer.agreement.status !== AgreementStatus.LOCKED_FOR_SIGNING &&
          signer.agreement.status !== AgreementStatus.PARTIALLY_SIGNED))
  ) {
    return NextResponse.json({ error: "This signing invitation has expired or is no longer active." }, { status: 410 });
  }
  if (signer.otpSendCount >= 5) {
    return NextResponse.json({ error: "The maximum number of verification codes has been sent." }, { status: 429 });
  }
  if (signer.otpSentAt && now.getTime() - signer.otpSentAt.getTime() < 60_000) {
    return NextResponse.json({ error: "Please wait a minute before requesting another code." }, { status: 429 });
  }

  const code = createSigningCode();
  const updated = await prisma.agreementSigner.updateMany({
    where: {
      id: signer.id,
      otpSendCount: signer.otpSendCount,
      ...(completedAgreementAccess ? {} : { signedAt: null, invitationExpiresAt: { gt: now } })
    },
    data: {
      otpHash: hashSigningSecret("otp", code),
      otpExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      otpAttempts: 0,
      otpSentAt: now,
      otpSendCount: { increment: 1 }
    }
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "This invitation changed. Reload and try again." }, { status: 409 });
  }

  try {
    await sendSigningInvitation({
      email: signer.email,
      signerName: signer.name,
      issuerName: signer.agreement.issuer.legalName,
      agreementTitle: signer.agreement.title,
      publicReference: signer.agreement.publicReference,
      invitationToken: parsed.data.token,
      verificationCode: code,
      completedAgreementAccess
    });
  } catch {
    console.error("Signing verification code could not be delivered.");
    return NextResponse.json({ error: "The verification code could not be delivered." }, { status: 503 });
  }
  return NextResponse.json({ message: "A new verification code was sent." });
}

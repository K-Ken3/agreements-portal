import { randomUUID } from "node:crypto";
import { AgreementSignerRole, AgreementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser, rejectCrossOriginMutation } from "@/lib/auth";
import { hashAgreementEvent, hashCanonicalContent, readAgreementParties } from "@/lib/agreements";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  createSigningCode,
  createSigningToken,
  EmailDeliveryError,
  hashSigningSecret,
  isEmailDeliveryConfigured,
  sendSigningInvitation
} from "@/lib/signing";

class SigningConflictError extends Error {}

const invitationSchema = z.object({
  method: z.enum(["email", "manual"]).default("email")
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose email delivery or a manual invitation link." }, { status: 400 });
  }
  const invitationMethod = parsed.data.method;
  if (invitationMethod === "email" && !isEmailDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Email delivery is not configured. Contact the administrator before requesting signatures." },
      { status: 503 }
    );
  }
  const { id } = await context.params;

  const agreement = await prisma.agreement.findFirst({
    where: { id, issuerUserId: user.id },
    include: {
      issuer: { select: { legalName: true, email: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 }
    }
  });
  if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  if (agreement.status !== AgreementStatus.DRAFT) {
    return NextResponse.json({ error: "Only a draft can be sent for signing." }, { status: 409 });
  }

  const version = agreement.versions[0];
  const parties = version ? readAgreementParties(version.canonicalContent) : null;
  if (!version || !parties) {
    return NextResponse.json(
      { error: "Add the other party before requesting signatures." },
      { status: 409 }
    );
  }
  const contentHash = hashCanonicalContent(version.canonicalContent);
  if (contentHash !== version.contentHash) {
    console.error("Agreement content fingerprint did not match its stored version.");
    return NextResponse.json({ error: "This agreement version could not be verified." }, { status: 409 });
  }
  if (parties.counterpartyEmail === agreement.issuer.email.toLowerCase()) {
    return NextResponse.json(
      { error: "The other party must use an email address different from yours." },
      { status: 400 }
    );
  }

  const now = new Date();
  const deadline = agreement.signingDeadline
    ? new Date(`${agreement.signingDeadline.toISOString().slice(0, 10)}T23:59:59.999Z`)
    : null;
  if (deadline && deadline <= now) {
    return NextResponse.json({ error: "The signing deadline has already passed." }, { status: 409 });
  }

  const invitationToken = createSigningToken();
  const verificationCode = invitationMethod === "email" ? createSigningCode() : null;
  const invitationExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (deadline && deadline < invitationExpiresAt) invitationExpiresAt.setTime(deadline.getTime());
  const otpExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const issuerSignerId = randomUUID();
  const counterpartySignerId = randomUUID();
  const eventId = randomUUID();
  const payload = {
    version: version.versionNumber,
    contentHash
  };

  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.agreement.findFirst({
        where: { id, issuerUserId: user.id },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
      });
      if (
        !current ||
        current.status !== AgreementStatus.DRAFT ||
        current.versions[0]?.id !== version.id ||
        current.versions[0].isLocked
      ) {
        throw new SigningConflictError("This draft changed. Reload it before requesting signatures.");
      }

      const previousEvent = await transaction.agreementEvent.findFirst({
        where: { agreementId: id },
        orderBy: { occurredAt: "desc" },
        select: { eventHash: true }
      });
      const occurredAt = new Date();
      const eventType = invitationMethod === "email"
        ? "agreement.signing_invited"
        : "agreement.manual_signing_link_created";
      const eventHash = hashAgreementEvent({
        agreementId: id,
        actorUserId: user.id,
        eventType,
        occurredAt: occurredAt.toISOString(),
        payload
      }, previousEvent?.eventHash ?? null);

      await transaction.agreementVersion.update({
        where: { id: version.id },
        data: { isLocked: true, lockedAt: occurredAt }
      });
      await transaction.agreement.update({
        where: { id },
        data: { status: AgreementStatus.LOCKED_FOR_SIGNING }
      });
      await transaction.agreementSigner.createMany({
        data: [
          {
            id: issuerSignerId,
            agreementId: id,
            role: AgreementSignerRole.ISSUER,
            name: agreement.issuer.legalName,
            email: agreement.issuer.email
          },
          {
            id: counterpartySignerId,
            agreementId: id,
            role: AgreementSignerRole.COUNTERPARTY,
            name: parties.counterpartyName,
            email: parties.counterpartyEmail,
            emailVerificationRequired: invitationMethod === "email",
            invitationTokenHash: hashSigningSecret("invitation", invitationToken),
            invitationExpiresAt,
            invitationSentAt: occurredAt,
            otpHash: verificationCode ? hashSigningSecret("otp", verificationCode) : null,
            otpExpiresAt: verificationCode ? otpExpiresAt : null,
            otpSentAt: verificationCode ? occurredAt : null,
            otpSendCount: verificationCode ? 1 : 0
          }
        ]
      });
      await transaction.agreementEvent.create({
        data: {
          id: eventId,
          agreementId: id,
          actorUserId: user.id,
          eventType,
          payload,
          occurredAt,
          previousEventHash: previousEvent?.eventHash ?? null,
          eventHash
        }
      });
    });
  } catch (error) {
    if (error instanceof SigningConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Agreement signing invitation could not be recorded.");
    return NextResponse.json({ error: "Unable to start signing right now." }, { status: 500 });
  }

  const invitationUrl = new URL(`/sign/${encodeURIComponent(invitationToken)}`, env.APP_URL).toString();
  if (invitationMethod === "manual") {
    return NextResponse.json({
      agreement: { id, status: AgreementStatus.LOCKED_FOR_SIGNING },
      invitation: {
        method: "manual",
        url: invitationUrl,
        expiresAt: invitationExpiresAt
      },
      message: "The agreement is locked. Share this secure link with the other party. Email ownership is not verified."
    }, { status: 201 });
  }

  if (!verificationCode) {
    console.error("Email invitation did not have a verification code.");
    return NextResponse.json({ error: "Unable to prepare the email verification code." }, { status: 500 });
  }

  try {
    await sendSigningInvitation({
      email: parties.counterpartyEmail,
      signerName: parties.counterpartyName,
      issuerName: agreement.issuer.legalName,
      agreementTitle: agreement.title,
      publicReference: agreement.publicReference,
      invitationToken,
      verificationCode
    });
  } catch (error) {
    try {
      await prisma.$transaction(async (transaction) => {
        const previousEvent = await transaction.agreementEvent.findFirst({
          where: { agreementId: id },
          orderBy: { occurredAt: "desc" },
          select: { eventHash: true }
        });
        const occurredAt = new Date();
        const failurePayload = { reason: "invitation_delivery_failed" };
        const eventHash = hashAgreementEvent({
          agreementId: id,
          actorUserId: user.id,
          eventType: "agreement.signing_invitation_failed",
          occurredAt: occurredAt.toISOString(),
          payload: failurePayload
        }, previousEvent?.eventHash ?? null);
        await transaction.agreementSigner.deleteMany({ where: { agreementId: id } });
        await transaction.agreementVersion.update({
          where: { id: version.id },
          data: { isLocked: false, lockedAt: null }
        });
        await transaction.agreement.update({
          where: { id, status: AgreementStatus.LOCKED_FOR_SIGNING },
          data: { status: AgreementStatus.DRAFT }
        });
        await transaction.agreementEvent.create({
          data: {
            id: randomUUID(),
            agreementId: id,
            actorUserId: user.id,
            eventType: "agreement.signing_invitation_failed",
            payload: failurePayload,
            occurredAt,
            previousEventHash: previousEvent?.eventHash ?? null,
            eventHash
          }
        });
      });
    } catch {
      console.error("Failed signing invitation could not be rolled back.");
      return NextResponse.json(
        { error: "Email delivery failed and the signing state needs administrator attention." },
        { status: 500 }
      );
    }
    if (error instanceof EmailDeliveryError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Signing invitation delivery failed.");
    return NextResponse.json({ error: "The invitation email could not be delivered." }, { status: 503 });
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.agreement.findFirst({
        where: { id, status: AgreementStatus.LOCKED_FOR_SIGNING },
        include: { signers: { where: { role: AgreementSignerRole.COUNTERPARTY } } }
      });
      if (!current || current.signers[0]?.signedAt) {
        throw new SigningConflictError("The agreement changed while the invitation was being sent.");
      }

      const occurredAt = new Date();
      const previousEvent = await transaction.agreementEvent.findFirst({
        where: { agreementId: id },
        orderBy: { occurredAt: "desc" },
        select: { eventHash: true }
      });
      const deliveryPayload = { role: "COUNTERPARTY" };
      const eventHash = hashAgreementEvent({
        agreementId: id,
        actorUserId: user.id,
        eventType: "agreement.invitation_delivered",
        occurredAt: occurredAt.toISOString(),
        payload: deliveryPayload
      }, previousEvent?.eventHash ?? null);
      await transaction.agreementSigner.update({
        where: { id: counterpartySignerId },
        data: { invitationSentAt: occurredAt }
      });
      await transaction.agreementEvent.create({
        data: {
          id: randomUUID(),
          agreementId: id,
          actorUserId: user.id,
          eventType: "agreement.invitation_delivered",
          payload: deliveryPayload,
          occurredAt,
          previousEventHash: previousEvent?.eventHash ?? null,
          eventHash
        }
      });
    });
  } catch (error) {
    if (error instanceof SigningConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Signing invitation delivery could not be recorded.");
    return NextResponse.json(
      { error: "The invitation was sent, but its delivery could not be recorded. Contact support before proceeding." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    agreement: { id, status: AgreementStatus.LOCKED_FOR_SIGNING },
    message: "The agreement is locked and the invitation was sent."
  }, { status: 201 });
}

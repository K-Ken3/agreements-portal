import { randomUUID } from "node:crypto";
import { AgreementSignerRole, AgreementStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser, rejectCrossOriginMutation } from "@/lib/auth";
import { hashAgreementEvent, hashCanonicalContent } from "@/lib/agreements";
import { prisma } from "@/lib/prisma";

const signatureSchema = z.object({
  signedName: z.string().trim().min(2).max(120),
  consent: z.literal(true)
});

class SignatureConflictError extends Error {}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your name and confirm that you agree to sign." },
      { status: 400 }
    );
  }
  if (parsed.data.signedName.toLocaleLowerCase() !== user.legalName.toLocaleLowerCase()) {
    return NextResponse.json(
      { error: "Enter the legal name on your account to sign this agreement." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const agreement = await transaction.agreement.findFirst({
        where: { id, issuerUserId: user.id },
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          signers: true
        }
      });
      if (!agreement) throw new SignatureConflictError("Agreement not found.");
      if (
        agreement.status !== AgreementStatus.LOCKED_FOR_SIGNING &&
        agreement.status !== AgreementStatus.PARTIALLY_SIGNED
      ) {
        throw new SignatureConflictError("This agreement is not open for signing.");
      }

      const version = agreement.versions[0];
      const issuerSigner = agreement.signers.find((signer) => signer.role === AgreementSignerRole.ISSUER);
      const counterpartySigner = agreement.signers.find(
        (signer) => signer.role === AgreementSignerRole.COUNTERPARTY
      );
      if (!version?.isLocked || !issuerSigner || !counterpartySigner?.invitationSentAt) {
        throw new SignatureConflictError("The signing invitation is not ready.");
      }
      if (!counterpartySigner.invitationExpiresAt || counterpartySigner.invitationExpiresAt <= new Date()) {
        throw new SignatureConflictError("The signing invitation has expired.");
      }
      if (issuerSigner.signedAt) throw new SignatureConflictError("You have already signed this agreement.");
      const contentHash = hashCanonicalContent(version.canonicalContent);
      if (contentHash !== version.contentHash) {
        throw new SignatureConflictError("The locked agreement version could not be verified.");
      }

      const signedAt = new Date();
      const previousEvent = await transaction.agreementEvent.findFirst({
        where: { agreementId: id },
        orderBy: { occurredAt: "desc" },
        select: { eventHash: true }
      });
      const payload = {
        role: AgreementSignerRole.ISSUER,
        version: version.versionNumber,
        contentHash
      };
      const eventHash = hashAgreementEvent({
        agreementId: id,
        actorUserId: user.id,
        eventType: "agreement.signed",
        occurredAt: signedAt.toISOString(),
        payload
      }, previousEvent?.eventHash ?? null);
      const update = await transaction.agreementSigner.updateMany({
        where: { id: issuerSigner.id, signedAt: null },
        data: { signedName: parsed.data.signedName, signedAt, signedContentHash: contentHash }
      });
      if (update.count !== 1) throw new SignatureConflictError("You have already signed this agreement.");

      const nextStatus = counterpartySigner.signedAt
        ? AgreementStatus.FINALIZED
        : AgreementStatus.PARTIALLY_SIGNED;
      await transaction.agreement.update({
        where: { id },
        data: { status: nextStatus }
      });
      await transaction.agreementEvent.create({
        data: {
          id: randomUUID(),
          agreementId: id,
          actorUserId: user.id,
          eventType: "agreement.signed",
          payload,
          occurredAt: signedAt,
          previousEventHash: previousEvent?.eventHash ?? null,
          eventHash
        }
      });
      return { signedAt, status: nextStatus, contentHash };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ signature: result });
  } catch (error) {
    if (error instanceof SignatureConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The agreement changed while you were signing. Reload and try again." },
        { status: 409 }
      );
    }
    console.error("Issuer signature could not be recorded.");
    return NextResponse.json({ error: "Unable to record your signature right now." }, { status: 500 });
  }
}

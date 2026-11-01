import { randomUUID } from "node:crypto";
import {
  AgreementSignerRole,
  AgreementStatus,
  Prisma
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginMutation } from "@/lib/auth";
import { hashAgreementEvent, hashCanonicalContent } from "@/lib/agreements";
import { prisma } from "@/lib/prisma";
import { hashSigningSecret } from "@/lib/signing";

const SESSION_COOKIE = "agreement_signing_session";
const signatureSchema = z.object({
  signedName: z.string().trim().min(2).max(120),
  consent: z.literal(true)
});

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const invitationToken = request.nextUrl.searchParams.get("token");
  if (!token || !invitationToken) {
    return NextResponse.json({ error: "Verify your email code to continue." }, { status: 401 });
  }
  const signer = await prisma.agreementSigner.findFirst({
    where: {
      sessionTokenHash: hashSigningSecret("session", token),
      invitationTokenHash: hashSigningSecret("invitation", invitationToken)
    },
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
  if (
    !signer ||
    signer.role !== AgreementSignerRole.COUNTERPARTY ||
    !signer.sessionExpiresAt ||
    signer.sessionExpiresAt <= new Date() ||
    !signer.verifiedAt
  ) {
    return NextResponse.json({ error: "Your signing session has expired. Verify your email again." }, { status: 401 });
  }
  const version = signer.agreement.versions[0];
  if (!version?.isLocked) {
    return NextResponse.json({ error: "The agreement is not ready for signing." }, { status: 409 });
  }
  return NextResponse.json({
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
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Verify your email code to continue." }, { status: 401 });

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

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const signer = await transaction.agreementSigner.findUnique({
        where: { sessionTokenHash: hashSigningSecret("session", token) },
        include: {
          agreement: {
            include: {
              versions: { orderBy: { versionNumber: "desc" }, take: 1 },
              signers: true
            }
          }
        }
      });
      if (
        !signer ||
        signer.role !== AgreementSignerRole.COUNTERPARTY ||
        !signer.verifiedAt ||
        !signer.sessionExpiresAt ||
        signer.sessionExpiresAt <= new Date()
      ) {
        throw new Error("SIGNING_SESSION_EXPIRED");
      }
      if (
        signer.agreement.status !== AgreementStatus.LOCKED_FOR_SIGNING &&
        signer.agreement.status !== AgreementStatus.PARTIALLY_SIGNED
      ) {
        throw new Error("AGREEMENT_NOT_OPEN");
      }
      if (!signer.invitationExpiresAt || signer.invitationExpiresAt <= new Date()) {
        throw new Error("INVITATION_EXPIRED");
      }
      if (signer.signedAt) throw new Error("ALREADY_SIGNED");
      if (parsed.data.signedName.toLocaleLowerCase() !== signer.name.toLocaleLowerCase()) {
        throw new Error("SIGNER_NAME_MISMATCH");
      }

      const version = signer.agreement.versions[0];
      if (!version?.isLocked || hashCanonicalContent(version.canonicalContent) !== version.contentHash) {
        throw new Error("CONTENT_HASH_MISMATCH");
      }
      const signedAt = new Date();
      const previousEvent = await transaction.agreementEvent.findFirst({
        where: { agreementId: signer.agreementId },
        orderBy: { occurredAt: "desc" },
        select: { eventHash: true }
      });
      const payload = {
        role: AgreementSignerRole.COUNTERPARTY,
        version: version.versionNumber,
        contentHash: version.contentHash
      };
      const eventHash = hashAgreementEvent({
        agreementId: signer.agreementId,
        actorUserId: null,
        eventType: "agreement.signed",
        occurredAt: signedAt.toISOString(),
        payload
      }, previousEvent?.eventHash ?? null);
      const update = await transaction.agreementSigner.updateMany({
        where: { id: signer.id, signedAt: null },
        data: {
          signedName: parsed.data.signedName,
          signedAt,
          signedContentHash: version.contentHash,
          sessionTokenHash: null,
          sessionExpiresAt: null
        }
      });
      if (update.count !== 1) throw new Error("ALREADY_SIGNED");

      const issuer = signer.agreement.signers.find((item) => item.role === AgreementSignerRole.ISSUER);
      const nextStatus = issuer?.signedAt
        ? AgreementStatus.FINALIZED
        : AgreementStatus.PARTIALLY_SIGNED;
      await transaction.agreement.update({
        where: { id: signer.agreementId },
        data: { status: nextStatus }
      });
      await transaction.agreementEvent.create({
        data: {
          id: randomUUID(),
          agreementId: signer.agreementId,
          actorUserId: null,
          eventType: "agreement.signed",
          payload,
          occurredAt: signedAt,
          previousEventHash: previousEvent?.eventHash ?? null,
          eventHash
        }
      });
      return { signedAt, status: nextStatus, contentHash: version.contentHash };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const response = NextResponse.json({ signature: result });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/signatures",
      expires: new Date(0)
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        SIGNING_SESSION_EXPIRED: { message: "Your signing session has expired. Verify your email again.", status: 401 },
        INVITATION_EXPIRED: { message: "The signing invitation has expired.", status: 410 },
        AGREEMENT_NOT_OPEN: { message: "This agreement is not open for signing.", status: 409 },
        ALREADY_SIGNED: { message: "You have already signed this agreement.", status: 409 },
        SIGNER_NAME_MISMATCH: { message: "Enter the name listed for you on this agreement.", status: 400 },
        CONTENT_HASH_MISMATCH: { message: "The locked agreement version could not be verified.", status: 409 }
      };
      const known = messages[error.message];
      if (known) return NextResponse.json({ error: known.message }, { status: known.status });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return NextResponse.json(
          { error: "The agreement changed while you were signing. Reload and try again." },
          { status: 409 }
        );
      }
    }
    console.error("Counterparty signature could not be recorded.");
    return NextResponse.json({ error: "Unable to record your signature right now." }, { status: 500 });
  }
}

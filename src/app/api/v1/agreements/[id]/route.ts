import { randomUUID } from "node:crypto";
import { AgreementStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, rejectCrossOriginMutation } from "@/lib/auth";
import {
  buildAgreementContent,
  hashAgreementEvent,
  hashCanonicalContent,
  readAgreementParties,
  updateAgreementSchema,
  type CreateAgreementInput
} from "@/lib/agreements";
import { prisma } from "@/lib/prisma";

class DraftConflictError extends Error {}

function contentFromVersion(
  canonicalContent: Prisma.JsonValue,
  agreement: {
    title: string;
    category: string;
    description: string | null;
    effectiveDate: Date | null;
    signingDeadline: Date | null;
  }
): CreateAgreementInput {
  const content =
    canonicalContent && typeof canonicalContent === "object" && !Array.isArray(canonicalContent)
      ? (canonicalContent as Record<string, unknown>)
      : {};
  const asDate = (value: unknown, fallback: Date | null) =>
    typeof value === "string"
      ? value
      : fallback
        ? fallback.toISOString().slice(0, 10)
        : undefined;

  return {
    title: typeof content.title === "string" ? content.title : agreement.title,
    category: typeof content.category === "string" ? content.category : agreement.category,
    description:
      typeof content.description === "string" ? content.description : (agreement.description ?? ""),
    clauses: typeof content.clauses === "string" ? content.clauses : "",
    currency: "RWF",
    effectiveDate: asDate(content.effectiveDate, agreement.effectiveDate),
    signingDeadline: asDate(content.signingDeadline, agreement.signingDeadline)
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;

  const agreement = await prisma.agreement.findFirst({
    where: { id, issuerUserId: user.id },
    include: {
      issuer: { select: { legalName: true, email: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      events: {
        select: { eventType: true, occurredAt: true, eventHash: true },
        orderBy: { occurredAt: "asc" }
      },
      signers: {
        select: {
          role: true,
          name: true,
          email: true,
          signedName: true,
          signedAt: true,
          signedContentHash: true
        },
        orderBy: { role: "asc" }
      }
    }
  });
  if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });

  const latestVersion = agreement.versions[0] ?? null;

  return NextResponse.json({
    agreement: {
      id: agreement.id,
      publicReference: agreement.publicReference,
      title: agreement.title,
      category: agreement.category,
      description: agreement.description,
      status: agreement.status,
      currency: agreement.currency,
      effectiveDate: agreement.effectiveDate,
      signingDeadline: agreement.signingDeadline,
      createdAt: agreement.createdAt,
      updatedAt: agreement.updatedAt,
      issuer: agreement.issuer,
      parties: latestVersion ? readAgreementParties(latestVersion.canonicalContent) : null,
      version: latestVersion
        ? {
            versionNumber: latestVersion.versionNumber,
            canonicalContent: latestVersion.canonicalContent,
            contentHash: latestVersion.contentHash,
            isLocked: latestVersion.isLocked,
            lockedAt: latestVersion.lockedAt
          }
        : null,
      events: agreement.events,
      signatures: agreement.signers
    }
  });
}

export async function PATCH(
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
  const parsed = updateAgreementSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the fields and try again.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const agreement = await prisma.agreement.findFirst({
    where: { id, issuerUserId: user.id },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 }
    }
  });
  if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  if (agreement.status !== AgreementStatus.DRAFT) {
    return NextResponse.json(
      { error: "Only drafts can be edited." },
      { status: 409 }
    );
  }

  const latestVersion = agreement.versions[0];
  if (!latestVersion || latestVersion.isLocked) {
    return NextResponse.json({ error: "This draft is locked and cannot be edited." }, { status: 409 });
  }

  const existingDetails = contentFromVersion(latestVersion.canonicalContent, agreement);
  const nextDetails = parsed.data.details ?? existingDetails;
  const nextParties = parsed.data.parties ?? readAgreementParties(latestVersion.canonicalContent);

  if (!nextDetails.clauses || nextDetails.clauses.length < 10) {
    return NextResponse.json(
      { error: "Add the agreement terms before continuing." },
      { status: 409 }
    );
  }

  const content = buildAgreementContent(nextDetails, nextParties);
  const contentHash = hashCanonicalContent(content);
  const sections = [
    parsed.data.details ? "details" : null,
    parsed.data.parties ? "parties" : null
  ].filter((section): section is string => Boolean(section));

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const currentVersion = await transaction.agreementVersion.findFirst({
        where: { agreementId: id },
        orderBy: { versionNumber: "desc" }
      });
      if (!currentVersion || currentVersion.isLocked) {
        throw new DraftConflictError("This draft cannot be edited right now.");
      }

      const versionNumber = currentVersion.versionNumber + 1;
      const occurredAt = new Date();
      const previousEvent = await transaction.agreementEvent.findFirst({
        where: { agreementId: id },
        orderBy: { occurredAt: "desc" },
        select: { eventHash: true }
      });
      const eventHash = hashAgreementEvent(
        {
          agreementId: id,
          actorUserId: user.id,
          eventType: "agreement.updated",
          occurredAt: occurredAt.toISOString(),
          payload: { version: versionNumber, contentHash, sections }
        },
        previousEvent?.eventHash ?? null
      );

      await transaction.agreement.update({
        where: { id },
        data: {
          title: content.title,
          category: content.category,
          description: content.description || null,
          currency: content.currency,
          effectiveDate: content.effectiveDate
            ? new Date(`${content.effectiveDate}T00:00:00.000Z`)
            : null,
          signingDeadline: content.signingDeadline
            ? new Date(`${content.signingDeadline}T00:00:00.000Z`)
            : null
        }
      });

      await transaction.agreementVersion.create({
        data: {
          agreementId: id,
          versionNumber,
          canonicalContent: content,
          contentHash,
          createdBy: user.id
        }
      });

      await transaction.agreementEvent.create({
        data: {
          id: randomUUID(),
          agreementId: id,
          actorUserId: user.id,
          eventType: "agreement.updated",
          payload: { version: versionNumber, contentHash, sections },
          occurredAt,
          previousEventHash: previousEvent?.eventHash ?? null,
          eventHash
        }
      });

      return { versionNumber, occurredAt };
    });

    return NextResponse.json({
      agreement: {
        id,
        status: agreement.status,
        versionNumber: result.versionNumber,
        contentHash,
        updatedAt: result.occurredAt
      }
    });
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This draft changed elsewhere. Reload it and try again." },
        { status: 409 }
      );
    }
    console.error("Agreement draft could not be updated.");
    return NextResponse.json({ error: "Unable to save your changes right now." }, { status: 500 });
  }
}

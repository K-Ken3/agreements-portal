import { randomBytes, randomUUID } from "node:crypto";
import { AgreementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, rejectCrossOriginMutation } from "@/lib/auth";
import {
  createAgreementSchema,
  hashAgreementEvent,
  hashCanonicalContent
} from "@/lib/agreements";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const agreements = await prisma.agreement.findMany({
    where: { issuerUserId: user.id },
    select: {
      id: true,
      publicReference: true,
      title: true,
      category: true,
      status: true,
      currency: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { updatedAt: "desc" },
    take: 50
  });
  return NextResponse.json({ agreements });
}

export async function POST(request: NextRequest) {
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
  const parsed = createAgreementSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the required fields and try again." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const content = {
    title: data.title,
    category: data.category,
    description: data.description,
    clauses: data.clauses,
    currency: data.currency,
    effectiveDate: data.effectiveDate ?? null,
    signingDeadline: data.signingDeadline ?? null
  };
  const contentHash = hashCanonicalContent(content);
  const eventId = randomUUID();
  const occurredAt = new Date();
  const publicReference = `AGR-${randomBytes(6).toString("hex").toUpperCase()}`;

  try {
    const agreement = await prisma.$transaction(async (transaction) => {
      const created = await transaction.agreement.create({
        data: {
          publicReference,
          issuerUserId: user.id,
          title: data.title,
          category: data.category,
          description: data.description || null,
          currency: data.currency,
          effectiveDate: data.effectiveDate ? new Date(`${data.effectiveDate}T00:00:00.000Z`) : null,
          signingDeadline: data.signingDeadline
            ? new Date(`${data.signingDeadline}T00:00:00.000Z`)
            : null,
          status: AgreementStatus.DRAFT
        }
      });

      const initialEventHash = hashAgreementEvent(
        {
          agreementId: created.id,
          actorUserId: user.id,
          eventType: "agreement.created",
          occurredAt: occurredAt.toISOString(),
          payload: { version: 1, contentHash }
        },
        null
      );
      await transaction.agreementVersion.create({
        data: {
          agreementId: created.id,
          versionNumber: 1,
          canonicalContent: content,
          contentHash,
          createdBy: user.id
        }
      });
      await transaction.agreementEvent.create({
        data: {
          id: eventId,
          agreementId: created.id,
          actorUserId: user.id,
          eventType: "agreement.created",
          payload: { version: 1, contentHash },
          occurredAt,
          previousEventHash: null,
          eventHash: initialEventHash
        }
      });
      return created;
    });
    return NextResponse.json(
      {
        agreement: {
          id: agreement.id,
          publicReference: agreement.publicReference,
          title: agreement.title,
          category: agreement.category,
          status: agreement.status,
          createdAt: agreement.createdAt
        }
      },
      { status: 201 }
    );
  } catch {
    console.error("Agreement draft could not be saved.");
    return NextResponse.json({ error: "Unable to save this draft right now." }, { status: 500 });
  }
}

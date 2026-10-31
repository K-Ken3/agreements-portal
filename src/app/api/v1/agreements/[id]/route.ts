import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      events: {
        select: { eventType: true, occurredAt: true, eventHash: true },
        orderBy: { occurredAt: "asc" }
      }
    }
  });
  if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });

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
      version: agreement.versions[0]
        ? {
            versionNumber: agreement.versions[0].versionNumber,
            canonicalContent: agreement.versions[0].canonicalContent,
            contentHash: agreement.versions[0].contentHash
          }
        : null,
      events: agreement.events
    }
  });
}

import { createHash } from "node:crypto";
import { z } from "zod";

export type AgreementState =
  | "draft"
  | "invited"
  | "recipient_accessed"
  | "details_pending"
  | "under_review"
  | "changes_requested"
  | "rejected"
  | "locked_for_signing"
  | "partially_signed"
  | "finalizing"
  | "finalized"
  | "expired"
  | "cancelled"
  | "disputed"
  | "superseded";

const transitions: Record<AgreementState, readonly AgreementState[]> = {
  draft: ["invited", "cancelled"],
  invited: ["recipient_accessed", "expired", "cancelled", "rejected"],
  recipient_accessed: ["details_pending", "under_review", "changes_requested", "rejected", "expired"],
  details_pending: ["under_review", "changes_requested", "rejected", "expired"],
  under_review: ["changes_requested", "rejected", "locked_for_signing"],
  changes_requested: ["draft", "cancelled"],
  rejected: [],
  locked_for_signing: ["partially_signed", "finalizing", "expired", "disputed"],
  partially_signed: ["finalizing", "expired", "disputed"],
  finalizing: ["finalized", "disputed"],
  finalized: ["disputed", "superseded"],
  expired: [],
  cancelled: [],
  disputed: ["superseded"],
  superseded: []
};

export function canTransitionAgreement(
  current: AgreementState,
  next: AgreementState
): boolean {
  return transitions[current].includes(next);
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError("Value is not JSON serializable.");
    return serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const properties = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${properties.join(",")}}`;
}

export function hashCanonicalContent(value: unknown): string {
  return createHash("sha256").update(`json-c14n-v1:${canonicalize(value)}`).digest("hex");
}

export function hashAgreementEvent(
  event: {
    agreementId: string;
    actorUserId: string;
    eventType: string;
    occurredAt: string;
    payload: unknown;
  },
  previousEventHash: string | null
): string {
  const content = canonicalize({ ...event, previousEventHash });
  return createHash("sha256").update(content).digest("hex");
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  });

export const optionalIsoDateSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, isoDateSchema.optional());

export const createAgreementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(1000).optional().default(""),
  clauses: z.string().trim().min(10).max(20000),
  currency: z.literal("RWF").default("RWF"),
  effectiveDate: optionalIsoDateSchema,
  signingDeadline: optionalIsoDateSchema
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;

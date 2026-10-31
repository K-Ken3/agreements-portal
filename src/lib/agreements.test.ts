import { describe, expect, it } from "vitest";
import {
  canTransitionAgreement,
  canonicalize,
  createAgreementSchema,
  hashCanonicalContent,
  hashAgreementEvent
} from "./agreements";

describe("agreement integrity helpers", () => {
  it("canonicalizes object keys consistently while preserving array order", () => {
    expect(canonicalize({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
    expect(hashCanonicalContent({ title: "Test", clauses: ["one", "two"] })).toBe(
      hashCanonicalContent({ clauses: ["one", "two"], title: "Test" })
    );
    expect(hashCanonicalContent({ clauses: ["two", "one"], title: "Test" })).not.toBe(
      hashCanonicalContent({ clauses: ["one", "two"], title: "Test" })
    );
  });

  it("chains event hashes to their predecessor", () => {
    const event = {
      agreementId: "agreement-id",
      actorUserId: "user-id",
      eventType: "agreement.created",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: { version: 1 }
    };
    expect(hashAgreementEvent(event, null)).not.toBe(hashAgreementEvent(event, "previous-hash"));
  });

  it("allows only defined workflow transitions", () => {
    expect(canTransitionAgreement("draft", "invited")).toBe(true);
    expect(canTransitionAgreement("draft", "finalized")).toBe(false);
    expect(canTransitionAgreement("finalized", "cancelled")).toBe(false);
  });

  it("treats blank optional dates as absent and rejects impossible dates", () => {
    const draft = {
      title: "Equipment rental",
      category: "Rental",
      clauses: "The equipment must be returned in good condition.",
      effectiveDate: "",
      signingDeadline: "  "
    };

    const parsed = createAgreementSchema.parse(draft);
    expect(parsed.effectiveDate).toBeUndefined();
    expect(parsed.signingDeadline).toBeUndefined();
    expect(createAgreementSchema.safeParse({ ...draft, effectiveDate: "2026-02-31" }).success).toBe(false);
    expect(createAgreementSchema.safeParse({ ...draft, effectiveDate: "2026-03-01" }).success).toBe(true);
  });
});

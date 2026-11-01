import { describe, expect, it } from "vitest";
import {
  buildAgreementContent,
  canTransitionAgreement,
  canonicalize,
  createAgreementSchema,
  hashCanonicalContent,
  hashAgreementEvent,
  partiesSchema,
  readAgreementParties,
  updateAgreementSchema
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
    expect(canTransitionAgreement("locked_for_signing", "finalized")).toBe(false);
    expect(canTransitionAgreement("partially_signed", "finalized")).toBe(true);
    expect(canTransitionAgreement("draft", "rejected")).toBe(false);
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

  it("normalises party details and rejects an invalid email", () => {
    const parsed = partiesSchema.parse({
      counterpartyName: "  Aline Uwase ",
      counterpartyEmail: " ALINE@Example.COM ",
      counterpartyOrganization: " Uwase Ltd "
    });
    expect(parsed).toEqual({
      counterpartyName: "Aline Uwase",
      counterpartyEmail: "aline@example.com",
      counterpartyOrganization: "Uwase Ltd",
      counterpartyRole: ""
    });
    expect(
      partiesSchema.safeParse({ counterpartyName: "A", counterpartyEmail: "not-an-email" }).success
    ).toBe(false);
  });

  it("builds version content with parties and reads them back", () => {
    const details = createAgreementSchema.parse({
      title: "Equipment rental",
      category: "Rental",
      clauses: "The equipment must be returned in good condition."
    });
    const parties = partiesSchema.parse({
      counterpartyName: "Aline Uwase",
      counterpartyEmail: "aline@example.com"
    });
    const content = buildAgreementContent(details, parties);

    expect(content.parties).toEqual(parties);
    expect(readAgreementParties(content)).toEqual(parties);
    expect(readAgreementParties({ title: "No parties yet" })).toBeNull();
  });

  it("requires at least one section when updating a draft", () => {
    expect(updateAgreementSchema.safeParse({}).success).toBe(false);
    expect(
      updateAgreementSchema.safeParse({
        parties: { counterpartyName: "Aline Uwase", counterpartyEmail: "aline@example.com" }
      }).success
    ).toBe(true);
  });
});

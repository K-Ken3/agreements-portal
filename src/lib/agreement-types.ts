export type AgreementParties = {
  counterpartyName: string;
  counterpartyEmail: string;
  counterpartyOrganization: string;
  counterpartyRole: string;
};

export type AgreementVersionSummary = {
  versionNumber: number;
  canonicalContent: {
    title?: string;
    category?: string;
    description?: string;
    clauses?: string;
    currency?: string;
    effectiveDate?: string | null;
    signingDeadline?: string | null;
    parties?: AgreementParties | null;
  };
  contentHash: string;
  isLocked: boolean;
  lockedAt: string | null;
};

export type AgreementDetail = {
  id: string;
  publicReference: string;
  title: string;
  category: string;
  description: string | null;
  status: string;
  currency: string;
  effectiveDate: string | null;
  signingDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  issuer: { legalName: string; email: string };
  parties: AgreementParties | null;
  version: AgreementVersionSummary | null;
  events: { eventType: string; occurredAt: string; eventHash: string }[];
  signatures: {
    role: "ISSUER" | "COUNTERPARTY";
    name: string;
    email: string;
    signedName: string | null;
    signedAt: string | null;
    signedContentHash: string | null;
  }[];
};

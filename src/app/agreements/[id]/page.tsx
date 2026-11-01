"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IssuerSignatureForm } from "@/components/issuer-signature-form";
import { BrandLogo } from "@/components/brand-logo";
import type { AgreementDetail } from "@/lib/agreement-types";

function formatDay(value: string | null | undefined): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

export default function AgreementDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [error, setError] = useState("");

  async function reloadAgreement() {
    try {
      const response = await fetch(`/api/v1/agreements/${encodeURIComponent(params.id)}`);
      if (!response.ok) throw new Error("Agreement not found.");
      const result = (await response.json()) as { agreement: AgreementDetail };
      setAgreement(result.agreement);
    } catch {
      setError("This agreement could not be refreshed.");
    }
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/agreements/${encodeURIComponent(params.id)}`)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok) throw new Error("Agreement not found or you do not have access.");
        return (await response.json()) as { agreement: AgreementDetail };
      })
      .then((result) => {
        if (active && result) setAgreement(result.agreement);
      })
      .catch(() => {
        if (active) setError("This agreement could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [params.id, router]);

  const isDraft = agreement?.status === "DRAFT";
  const isFinalized = agreement?.status === "FINALIZED";
  const isSigning = agreement?.status === "LOCKED_FOR_SIGNING" || agreement?.status === "PARTIALLY_SIGNED";
  const parties = agreement?.parties ?? null;
  const versionNumber = agreement?.version?.versionNumber ?? 1;
  const nextHref = parties ? `/agreements/${params.id}/review` : `/agreements/${params.id}/parties`;

  return (
    <main className="app-shell">
      <aside className="sidebar"><Link className="brand sidebar-brand" href="/dashboard"><BrandLogo /></Link><span className="sidebar-label">WORKSPACE</span><nav className="sidebar-nav"><Link className="sidebar-link" href="/dashboard"><span>▦</span> Overview</Link><Link className="sidebar-link active" href="/dashboard#agreements"><span>▤</span> Agreements</Link></nav></aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumbs"><Link href="/dashboard">Workspace</Link><span>/</span><Link href="/dashboard#agreements">Agreements</Link><span>/</span><strong>Details</strong></div><Link className="button button-quiet" href="/dashboard"><span aria-hidden="true">←</span> Back to workspace</Link></header>
        <div className="details-content">
          {error ? <div className="inline-error" role="alert">{error}</div> : !agreement ? <div className="list-loading">Loading agreement…</div> : (
            <>
              <div className="details-heading">
                <div><span className="eyebrow">{agreement.publicReference}</span><h1>{agreement.title}</h1><p>{agreement.category} <span>·</span> Created {formatDay(agreement.createdAt)} <span>·</span> Version {versionNumber}</p></div>
                <div className="details-actions">
                  {isDraft && <Link className="button button-outline button-small" href={`/agreements/${agreement.id}/edit`}>Edit draft</Link>}
                  {isDraft && <Link className="button button-primary button-small" href={nextHref}>{parties ? "Review & request signatures" : "Continue setup"} <span aria-hidden="true">→</span></Link>}
                  <span className={`status-badge status-${agreement.status.toLowerCase()}`}><i />{agreement.status.toLowerCase().replaceAll("_", " ")}</span>
                </div>
              </div>

              <section className="timeline-card">
                <div className="panel-heading"><div><h2>Agreement progress</h2><p>{isFinalized ? "Both parties signed this locked version." : isSigning ? "This version is locked while both parties complete signing." : "Your draft is private and has not been shared."}</p></div><span className={`status-badge status-${agreement.status.toLowerCase()}`}><i />{isFinalized ? "Finalised" : isSigning ? "Signing" : "Draft"}</span></div>
                <div className="timeline">
                  <div className="timeline-step complete"><span>✓</span><div><strong>Draft created</strong><small>Version 1 · {new Date(agreement.createdAt).toLocaleString()}</small></div></div>
                  <div className={`timeline-step ${parties ? "complete" : "upcoming"}`}><span>{parties ? "✓" : "2"}</span><div><strong>{parties ? "Other party added" : "Add the other party"}</strong><small>{parties ? `${parties.counterpartyName} · ${parties.counterpartyEmail}` : "Record who this agreement is with before reviewing it."}</small>{isDraft && !parties && <Link className="timeline-link" href={`/agreements/${agreement.id}/parties`}>Add party →</Link>}</div></div>
                  <div className={`timeline-step ${isFinalized ? "complete" : isSigning ? "complete" : "upcoming"}`}><span>{isFinalized ? "✓" : isSigning ? "…" : "3"}</span><div><strong>{isFinalized ? "Both parties signed" : isSigning ? "Signatures in progress" : "Review and request signatures"}</strong><small>{isFinalized ? `Locked ${agreement.version?.lockedAt ? new Date(agreement.version.lockedAt).toLocaleString() : formatDay(agreement.updatedAt)}` : isSigning ? "The invited party verifies their email and both parties sign this version." : "Review the complete terms, then invite the other party to sign."}</small>{isDraft && parties && <Link className="timeline-link" href={`/agreements/${agreement.id}/review`}>Review & request signatures →</Link>}</div></div>
                </div>
              </section>

              <section className="document-preview-card">
                <div className="document-preview-header"><div><span className="eyebrow">VERSION {versionNumber} · {isFinalized ? "FINALISED RECORD" : "DRAFT PREVIEW"}</span><h2>{agreement.title}</h2></div><span className={isFinalized ? "final-stamp" : "draft-stamp"}>{isFinalized ? "FINALISED" : "NOT SHARED"}</span></div>
                <div className="document-meta-grid"><div><small>CATEGORY</small><strong>{agreement.category}</strong></div><div><small>CURRENCY</small><strong>{agreement.currency}</strong></div><div><small>EFFECTIVE DATE</small><strong>{formatDay(agreement.effectiveDate)}</strong></div><div><small>SIGNING DEADLINE</small><strong>{formatDay(agreement.signingDeadline)}</strong></div></div>
                <div className="parties-summary">
                  <div><small>PREPARED BY</small><strong>{agreement.issuer.legalName}</strong><span>{agreement.issuer.email}</span></div>
                  <div><small>OTHER PARTY</small>{parties ? <><strong>{parties.counterpartyName}</strong><span>{parties.counterpartyEmail}</span>{parties.counterpartyOrganization && <span>{parties.counterpartyOrganization}</span>}{parties.counterpartyRole && <span>{parties.counterpartyRole}</span>}</> : <><strong>Not added yet</strong>{isDraft && <Link className="timeline-link" href={`/agreements/${agreement.id}/parties`}>Add the other party →</Link>}</>}</div>
                </div>
                {agreement.description && <p className="preview-description">{agreement.description}</p>}
                <h3>Terms</h3>
                <div className="terms-text">{agreement.version?.canonicalContent.clauses ?? "No terms have been added to this draft."}</div>
                <div className="hash-row"><span>{isFinalized ? "Final content fingerprint" : "Draft content fingerprint"}</span><code>{agreement.version?.contentHash ?? "Unavailable"}</code></div>
              </section>

              {agreement.signatures.length > 0 && (
                <section className="review-card signature-card">
                  <div className="review-card-heading"><div><span className="eyebrow">SIGNATURES</span><h2>Signing record</h2></div></div>
                  <div className="signature-list">
                    {agreement.signatures.map((signature) => (
                      <div className="signature-record" key={signature.role}>
                        <small>{signature.role === "ISSUER" ? "PREPARED BY" : "OTHER PARTY"}</small>
                        <strong>{signature.signedName ?? signature.name}</strong>
                        <span>{signature.email}</span>
                        <span>{signature.signedAt ? `Signed ${new Date(signature.signedAt).toLocaleString()}` : "Awaiting signature"}</span>
                        {signature.signedAt && signature.signedContentHash && <code>{signature.signedContentHash}</code>}
                      </div>
                    ))}
                  </div>
                  {agreement.status !== "FINALIZED" && <p className="legal-note">The agreement becomes final after both parties sign the locked version.</p>}
                </section>
              )}
              {agreement.status === "LOCKED_FOR_SIGNING" || agreement.status === "PARTIALLY_SIGNED" ? (
                agreement.signatures.find((signature) => signature.role === "ISSUER")?.signedAt ? (
                  <div className="inline-notice" role="status">Your signature is recorded. The other party must sign before the agreement is final.</div>
                ) : (
                  <section className="review-card signature-card">
                    <div className="review-card-heading"><div><span className="eyebrow">YOUR SIGNATURE</span><h2>Sign this locked version</h2></div></div>
                    <IssuerSignatureForm agreementId={agreement.id} signerName={agreement.issuer.legalName} onSigned={reloadAgreement} />
                  </section>
                )
              ) : null}
              <p className="legal-note">{isFinalized ? "Both parties signed this locked version. In-app signatures are not a qualified digital signature or a guarantee of legal enforceability." : isDraft ? "This draft is private and not signed. Request both signatures to create a final agreement." : "This version is locked for signing and cannot be edited."}</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StepProgress } from "@/components/step-progress";
import type { AgreementDetail } from "@/lib/agreement-types";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

export default function AgreementReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [manualLinkConfirmed, setManualLinkConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/agreements/${encodeURIComponent(params.id)}`)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok) throw new Error("Agreement not found.");
        return (await response.json()) as { agreement: AgreementDetail };
      })
      .then((result) => {
        if (active && result) setAgreement(result.agreement);
      })
      .catch(() => {
        if (active) setLoadError("This agreement could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [params.id, router]);

  async function requestSignatures(method: "email" | "manual") {
    setPending(true);
    setError("");
    setInvitationUrl("");
    setLinkCopied(false);
    try {
      const response = await fetch(`/api/v1/agreements/${encodeURIComponent(params.id)}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method })
      });
      const result = (await response.json()) as {
        error?: string;
        invitation?: { method: "manual"; url: string };
      };
      if (!response.ok) {
        setError(result.error ?? "We couldn’t send the signing invitation.");
        return;
      }
      if (method === "manual" && result.invitation?.url) {
        setInvitationUrl(result.invitation.url);
        return;
      }
      router.push(`/agreements/${params.id}`);
      router.refresh();
    } catch {
      setError("Connection problem. The signing invitation was not sent. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyInvitationLink() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setLinkCopied(true);
      setError("");
    } catch {
      setLinkCopied(false);
      setError("Automatic copying is unavailable. Select the invitation link above and copy it manually.");
    }
  }

  const parties = agreement?.parties;
  const canFinalize =
    agreement?.status === "DRAFT" && Boolean(parties) && confirmed && !pending && !invitationUrl;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/dashboard"><span>AgreeIt</span></Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav" aria-label="Workspace"><Link className="sidebar-link" href="/dashboard"><span>▦</span> Overview</Link><Link className="sidebar-link active" href="/dashboard#agreements"><span>▤</span> Agreements</Link></nav>
        <div className="sidebar-bottom"><div className="sidebar-help"><span>i</span><div><strong>Final review</strong><small>Check before you lock the record</small></div></div></div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumbs"><Link href="/dashboard">Workspace</Link> <span>/</span> <Link href={`/agreements/${params.id}`}>Agreement</Link> <span>/</span> <strong>Review</strong></div><Link className="button button-quiet" href={`/agreements/${params.id}`}>Back to agreement</Link></header>
        <div className="form-page-content">
          {loadError ? (
            <div className="inline-error" role="alert">{loadError}</div>
          ) : !agreement ? (
            <div className="list-loading">Loading agreement…</div>
          ) : (
            <>
              <div className="form-page-heading">
                <span className="eyebrow">{agreement.publicReference} · STEP 3 OF 3</span>
                <h1>Review and request signatures.</h1>
                <p>Check every detail. Requesting signatures locks version {agreement.version?.versionNumber ?? 1}; the agreement is final only after both parties sign.</p>
              </div>
              <StepProgress current={3} />

              {agreement.status !== "DRAFT" ? (
                <div className="inline-notice" role="status">
                  This agreement is {agreement.status.toLowerCase().replaceAll("_", " ")}; its terms are locked and cannot be changed.
                  <Link className="timeline-link" href={`/agreements/${agreement.id}`}>View the signing record →</Link>
                </div>
              ) : !parties ? (
                <div className="inline-notice" role="status">
                  Add the other party before finalising this agreement.
                  <Link className="timeline-link" href={`/agreements/${agreement.id}/parties`}>Add the other party →</Link>
                </div>
              ) : (
                <>
                  <section className="review-card">
                    <div className="review-card-heading"><div><span className="eyebrow">AGREEMENT SUMMARY</span><h2>{agreement.title}</h2></div><span className="status-badge status-draft"><i />draft</span></div>
                    <div className="review-grid">
                      <div className="review-item"><small>CATEGORY</small><strong>{agreement.category}</strong></div>
                      <div className="review-item"><small>CURRENCY</small><strong>{agreement.currency}</strong></div>
                      <div className="review-item"><small>EFFECTIVE DATE</small><strong>{formatDate(agreement.version?.canonicalContent.effectiveDate)}</strong></div>
                      <div className="review-item"><small>SIGNING DEADLINE</small><strong>{formatDate(agreement.version?.canonicalContent.signingDeadline)}</strong></div>
                    </div>
                  </section>

                  <section className="review-card">
                    <div className="review-card-heading"><div><span className="eyebrow">PARTIES</span><h2>Who is involved</h2></div></div>
                    <div className="review-grid">
                      <div className="review-item"><small>PREPARED BY</small><strong>{agreement.issuer.legalName}</strong><span>{agreement.issuer.email}</span></div>
                      <div className="review-item"><small>OTHER PARTY</small><strong>{parties.counterpartyName}</strong><span>{parties.counterpartyEmail}</span>{parties.counterpartyOrganization && <span>{parties.counterpartyOrganization}</span>}{parties.counterpartyRole && <span>{parties.counterpartyRole}</span>}</div>
                    </div>
                  </section>

                  <section className="review-card">
                    <div className="review-card-heading"><div><span className="eyebrow">TERMS</span><h2>Agreement terms</h2></div></div>
                    {agreement.version?.canonicalContent.description && <p className="preview-description">{agreement.version.canonicalContent.description}</p>}
                    <div className="terms-text">{agreement.version?.canonicalContent.clauses ?? "No terms have been added."}</div>
                    <div className="hash-row"><span>Content fingerprint · version {agreement.version?.versionNumber ?? 1}</span><code>{agreement.version?.contentHash ?? "Unavailable"}</code></div>
                  </section>

                  <label className="confirm-row">
                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                    <span>I have reviewed this agreement and understand that sending the invitation locks this version. The other party must verify their email and both parties must sign before it is final.</span>
                  </label>

                  {error && <p className="form-error review-error" role="alert">{error}</p>}

                  <div className="review-actions">
                    <Link className="button button-quiet" href={`/agreements/${agreement.id}/edit`}>← Edit details</Link>
                    <div className="review-actions-right">
                      <Link className="button button-outline" href={`/agreements/${agreement.id}/parties`}>Edit party</Link>
                      <button className="button button-primary" type="button" onClick={() => requestSignatures("email")} disabled={!canFinalize}>{pending ? "Sending invitation…" : "Email signing invitation"} <span aria-hidden="true">→</span></button>
                    </div>
                  </div>
                  <section className="manual-invitation">
                    <h2>Share a signing link manually</h2>
                    <p>Create a secure link to share with the other party through your own trusted channel. Anyone with the link can access the agreement; this option does not verify their email address.</p>
                    <label className="confirm-row">
                      <input type="checkbox" checked={manualLinkConfirmed} onChange={(event) => setManualLinkConfirmed(event.target.checked)} />
                      <span>I understand that a manual link is a bearer credential and does not verify the recipient’s email ownership.</span>
                    </label>
                    <button className="button button-outline" type="button" onClick={() => requestSignatures("manual")} disabled={!canFinalize || !manualLinkConfirmed}>
                      {pending ? "Creating secure link…" : "Create manual invitation link"}
                    </button>
                    {invitationUrl && (
                      <div className="manual-link-result" role="status">
                        <label className="field">
                          <span>Copy this secure link now. It is shown only once.</span>
                          <input value={invitationUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
                        </label>
                        <button className="button button-primary" type="button" onClick={copyInvitationLink}>
                          {linkCopied ? "Link copied" : "Copy invitation link"}
                        </button>
                        <p className="legal-note">The agreement is locked for signing. The link expires within seven days or at the signing deadline, whichever comes first. Share it only with the intended party.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
              <p className="legal-note">Email invitations require a verified sender domain. Manual links do not verify email ownership. In-app signatures are not a qualified digital signature or a guarantee of legal enforceability.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

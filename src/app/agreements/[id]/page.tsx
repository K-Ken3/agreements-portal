"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AgreementDetails = {
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
  version: {
    versionNumber: number;
    canonicalContent: { clauses?: string };
    contentHash: string;
  } | null;
};

export default function AgreementDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [agreement, setAgreement] = useState<AgreementDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/agreements/${encodeURIComponent(params.id)}`)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok) throw new Error("Agreement not found or you do not have access.");
        return (await response.json()) as { agreement: AgreementDetails };
      })
      .then((result) => { if (active && result) setAgreement(result.agreement); })
      .catch(() => { if (active) setError("This agreement could not be loaded."); });
    return () => { active = false; };
  }, [params.id, router]);

  return (
    <main className="app-shell">
      <aside className="sidebar"><Link className="brand sidebar-brand" href="/dashboard"><span>AgreeIt</span></Link><span className="sidebar-label">WORKSPACE</span><nav className="sidebar-nav"><Link className="sidebar-link" href="/dashboard"><span>▦</span> Overview</Link><Link className="sidebar-link active" href="/dashboard#agreements"><span>▤</span> Agreements</Link></nav></aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumbs"><Link href="/dashboard">Workspace</Link><span>/</span><Link href="/dashboard#agreements">Agreements</Link><span>/</span><strong>Details</strong></div><Link className="button button-quiet" href="/dashboard">← Back to workspace</Link></header>
        <div className="details-content">
          {error ? <div className="inline-error" role="alert">{error}</div> : !agreement ? <div className="list-loading">Loading agreement…</div> : (
            <>
              <div className="details-heading"><div><span className="eyebrow">{agreement.publicReference}</span><h1>{agreement.title}</h1><p>{agreement.category} <span>·</span> Created {new Date(agreement.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p></div><span className={`status-badge status-${agreement.status.toLowerCase()}`}><i />{agreement.status.toLowerCase()}</span></div>
              <section className="timeline-card"><div className="panel-heading"><div><h2>Agreement progress</h2><p>Your draft is private and has not been shared.</p></div><span className="status-badge status-draft"><i />Draft</span></div><div className="timeline"><div className="timeline-step complete"><span>✓</span><div><strong>Draft created</strong><small>Version {agreement.version?.versionNumber ?? 1} · {new Date(agreement.createdAt).toLocaleString()}</small></div></div><div className="timeline-step upcoming"><span>2</span><div><strong>Invite the other party</strong><small>Invitation and review workflow are not enabled yet.</small></div></div><div className="timeline-step upcoming"><span>3</span><div><strong>Review and sign</strong><small>Both parties will need to review and sign the same version.</small></div></div></div></section>
              <section className="document-preview-card"><div className="document-preview-header"><div><span className="eyebrow">VERSION {agreement.version?.versionNumber ?? 1} · DRAFT PREVIEW</span><h2>{agreement.title}</h2></div><span className="draft-stamp">NOT SHARED</span></div><div className="document-meta-grid"><div><small>CATEGORY</small><strong>{agreement.category}</strong></div><div><small>CURRENCY</small><strong>{agreement.currency}</strong></div><div><small>EFFECTIVE DATE</small><strong>{agreement.effectiveDate ? new Date(agreement.effectiveDate).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "Not set"}</strong></div><div><small>SIGNING DEADLINE</small><strong>{agreement.signingDeadline ? new Date(agreement.signingDeadline).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "Not set"}</strong></div></div>{agreement.description && <p className="preview-description">{agreement.description}</p>}<h3>Terms</h3><div className="terms-text">{agreement.version?.canonicalContent.clauses ?? "No terms have been added to this draft."}</div><div className="hash-row"><span>Draft content fingerprint</span><code>{agreement.version?.contentHash ?? "Unavailable"}</code></div></section>
              <p className="legal-note">This draft is not signed and is not a finalized agreement. Agreement workflow features will be added in a later phase.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

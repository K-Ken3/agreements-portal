"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { StepProgress } from "@/components/step-progress";
import type { AgreementDetail } from "@/lib/agreement-types";

export default function AgreementPartiesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try {
      const response = await fetch(`/api/v1/agreements/${encodeURIComponent(params.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parties: payload })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "We couldn’t save the other party.");
        return;
      }
      router.push(`/agreements/${params.id}/review`);
      router.refresh();
    } catch {
      setError("Connection problem. The other party was not saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const parties = agreement?.parties;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/dashboard"><span>AgreeIt</span></Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav" aria-label="Workspace"><Link className="sidebar-link" href="/dashboard"><span>▦</span> Overview</Link><Link className="sidebar-link active" href="/dashboard#agreements"><span>▤</span> Agreements</Link></nav>
        <div className="sidebar-bottom"><div className="sidebar-help"><span>i</span><div><strong>Private draft</strong><small>No message is sent yet</small></div></div></div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumbs"><Link href="/dashboard">Workspace</Link> <span>/</span> <Link href={`/agreements/${params.id}`}>Agreement</Link> <span>/</span> <strong>Parties</strong></div><Link className="button button-quiet" href={`/agreements/${params.id}`}>Back to agreement</Link></header>
        <div className="form-page-content">
          {loadError ? (
            <div className="inline-error" role="alert">{loadError}</div>
          ) : !agreement ? (
            <div className="list-loading">Loading draft…</div>
          ) : agreement.status !== "DRAFT" ? (
            <div className="inline-notice" role="status">
              This agreement is {agreement.status.toLowerCase().replaceAll("_", " ")} and can no longer be changed.
              <Link className="timeline-link" href={`/agreements/${agreement.id}`}>View the agreement →</Link>
            </div>
          ) : (
            <>
              <div className="form-page-heading">
                <span className="eyebrow">{agreement.publicReference} · STEP 2 OF 3</span>
                <h1>Who is the other party?</h1>
                <p>Add the person or organisation this agreement is with. Their details stay private until you invite them.</p>
              </div>
              <StepProgress current={2} />
              <form className="agreement-form-card" onSubmit={submit}>
                <div className="form-section-title"><span className="section-number">2</span><div><h2>Other party</h2><p>You can correct these details before you request signatures.</p></div></div>
                <label className="field"><span>Full name <b>*</b></span><input name="counterpartyName" defaultValue={parties?.counterpartyName ?? ""} minLength={2} maxLength={120} required placeholder="e.g. Aline Uwase" /></label>
                <div className="field-row">
                  <label className="field"><span>Email address <b>*</b></span><input name="counterpartyEmail" type="email" defaultValue={parties?.counterpartyEmail ?? ""} maxLength={200} required placeholder="name@example.com" /></label>
                  <label className="field"><span>Organisation <em>Optional</em></span><input name="counterpartyOrganization" defaultValue={parties?.counterpartyOrganization ?? ""} maxLength={120} placeholder="Company or institution" /></label>
                </div>
                <label className="field"><span>Role in the agreement <em>Optional</em></span><input name="counterpartyRole" defaultValue={parties?.counterpartyRole ?? ""} maxLength={80} placeholder="e.g. Tenant, Supplier, Borrower" /><small>This helps both parties understand the relationship at a glance.</small></label>
                <div className="form-divider" />
                <div className="form-section-title"><span className="section-number">1</span><div><h2>Your side</h2><p>These details come from your account.</p></div></div>
                <div className="review-grid">
                  <div className="review-item"><small>PREPARED BY</small><strong>{agreement.issuer.legalName}</strong><span>{agreement.issuer.email}</span></div>
                  <div className="review-item"><small>REFERENCE</small><strong>{agreement.publicReference}</strong><span>Only you can see this draft</span></div>
                </div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><Link className="button button-quiet" href={`/agreements/${agreement.id}/edit`}>← Back to details</Link><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving party…" : "Save & continue"} <span aria-hidden="true">→</span></button></div>
              </form>
              <p className="legal-note">You will review the complete agreement before sending a private email invitation. Both parties must sign before the agreement is finalised.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

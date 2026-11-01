"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { StepProgress } from "@/components/step-progress";
import { BrandLogo } from "@/components/brand-logo";
import type { AgreementDetail } from "@/lib/agreement-types";

function asDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function EditAgreementPage() {
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
        body: JSON.stringify({ details: payload })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "We couldn’t save your changes.");
        return;
      }
      router.push(`/agreements/${params.id}`);
      router.refresh();
    } catch {
      setError("Connection problem. Your changes were not saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const content = agreement?.version?.canonicalContent;
  const versions = agreement?.version?.versionNumber;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/dashboard"><BrandLogo /></Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav" aria-label="Workspace"><Link className="sidebar-link" href="/dashboard"><span>▦</span> Overview</Link><Link className="sidebar-link active" href="/dashboard#agreements"><span>▤</span> Agreements</Link></nav>
        <div className="sidebar-bottom"><div className="sidebar-help"><span>i</span><div><strong>Editing a draft</strong><small>Each save creates a new version</small></div></div></div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumbs"><Link href="/dashboard">Workspace</Link> <span>/</span> <Link href={`/agreements/${params.id}`}>Agreement</Link> <span>/</span> <strong>Edit</strong></div><Link className="button button-quiet" href={`/agreements/${params.id}`}>Back to agreement</Link></header>
        <div className="form-page-content">
          {loadError ? (
            <div className="inline-error" role="alert">{loadError}</div>
          ) : !agreement ? (
            <div className="list-loading">Loading draft…</div>
          ) : agreement.status !== "DRAFT" ? (
            <div className="inline-notice" role="status">
              This agreement is {agreement.status.toLowerCase().replaceAll("_", " ")} and can no longer be edited.
              <Link className="timeline-link" href={`/agreements/${agreement.id}`}>View the agreement →</Link>
            </div>
          ) : (
            <>
              <div className="form-page-heading">
                <span className="eyebrow">{agreement.publicReference} · EDIT DRAFT</span>
                <h1>Refine the details.</h1>
                <p>Editing creates version {typeof versions === "number" ? versions + 1 : 2} of this draft. Earlier versions remain part of the record.</p>
              </div>
              <StepProgress current={1} />
              <form className="agreement-form-card" onSubmit={submit}>
                <div className="form-section-title"><span className="section-number">1</span><div><h2>Agreement details</h2><p>Give this draft a clear title and a little context.</p></div></div>
                <label className="field"><span>Agreement title <b>*</b></span><input name="title" defaultValue={content?.title ?? agreement.title} minLength={3} maxLength={120} required /><small>Use a name both parties will recognize.</small></label>
                <div className="field-row">
                  <label className="field"><span>Category <b>*</b></span><select name="category" defaultValue={content?.category ?? agreement.category} required><option value="" disabled>Select a category</option><option>Services</option><option>Sale of goods</option><option>Rental</option><option>Employment</option><option>Loan</option><option>Other</option></select></label>
                  <label className="field"><span>Currency</span><input value="RWF · Rwandan franc" readOnly aria-readonly="true" /><input name="currency" type="hidden" value="RWF" /></label>
                </div>
                <label className="field"><span>Short description <em>Optional</em></span><textarea name="description" rows={3} maxLength={1000} defaultValue={content?.description ?? agreement.description ?? ""} placeholder="What is this agreement about?" /></label>
                <div className="form-divider" />
                <div className="form-section-title"><span className="section-number">2</span><div><h2>Set out the terms</h2><p>Write the key responsibilities and conditions in plain language.</p></div></div>
                <label className="field"><span>Agreement terms <b>*</b></span><textarea name="clauses" rows={9} minLength={10} maxLength={20000} defaultValue={content?.clauses ?? ""} required /><small>Draft terms are private. Legal effect depends on applicable law and the specific agreement.</small></label>
                <div className="form-divider" />
                <div className="form-section-title"><span className="section-number">3</span><div><h2>Important dates</h2><p>Dates are optional and can be added later.</p></div></div>
                <div className="field-row">
                  <label className="field"><span>Effective date <em>Optional</em></span><input name="effectiveDate" type="date" defaultValue={asDateInput(content?.effectiveDate ?? agreement.effectiveDate)} /></label>
                  <label className="field"><span>Signing deadline <em>Optional</em></span><input name="signingDeadline" type="date" defaultValue={asDateInput(content?.signingDeadline ?? agreement.signingDeadline)} /></label>
                </div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><Link className="button button-quiet" href={`/agreements/${agreement.id}`}>Cancel</Link><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving changes…" : "Save changes"} <span aria-hidden="true">→</span></button></div>
              </form>
              <p className="legal-note">Saving creates a new immutable version. The previous version and its fingerprint stay in the agreement record.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

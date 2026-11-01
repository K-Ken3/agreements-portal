"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { StepProgress } from "@/components/step-progress";

export default function NewAgreementPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/users/me").then((response) => {
      if (response.status === 401) router.replace("/login");
    }).catch(() => setError("We couldn’t verify your session. Refresh and try again."));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try {
      const response = await fetch("/api/v1/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { error?: string; agreement?: { id: string } };
      if (!response.ok || !result.agreement) {
        setError(result.error ?? "We couldn’t save this draft.");
        return;
      }
      router.push(`/agreements/${result.agreement.id}/parties`);
    } catch {
      setError("Connection problem. Your draft was not saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/dashboard"><span>AgreeIt</span></Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav" aria-label="Workspace"><Link className="sidebar-link" href="/dashboard"><span>▦</span> Overview</Link><a className="sidebar-link active" href="#agreement-form"><span>＋</span> New agreement</a></nav>
        <div className="sidebar-bottom"><div className="sidebar-help"><span>i</span><div><strong>Start with the essentials</strong><small>You can refine your draft later</small></div></div></div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumbs"><Link href="/dashboard">Workspace</Link> <span>/</span> <strong>New agreement</strong></div><Link className="button button-quiet" href="/dashboard">Back to workspace</Link></header>
        <div className="form-page-content">
          <div className="form-page-heading"><span className="eyebrow">NEW AGREEMENT · STEP 1 OF 3</span><h1>Start with the essentials.</h1><p>Create a private draft. Nothing is sent to anyone until you choose to invite them.</p></div>
          <StepProgress current={1} />
          <form id="agreement-form" className="agreement-form-card" onSubmit={submit}>
            <div className="form-section-title"><span className="section-number">1</span><div><h2>Agreement details</h2><p>Give this draft a clear title and a little context.</p></div></div>
            <label className="field"><span>Agreement title <b>*</b></span><input name="title" placeholder="e.g. Equipment rental agreement" minLength={3} maxLength={120} required /><small>Use a name both parties will recognize.</small></label>
            <div className="field-row">
              <label className="field"><span>Category <b>*</b></span><select name="category" defaultValue="" required><option value="" disabled>Select a category</option><option>Services</option><option>Sale of goods</option><option>Rental</option><option>Employment</option><option>Loan</option><option>Other</option></select></label>
              <label className="field"><span>Currency</span><input value="RWF · Rwandan franc" readOnly aria-readonly="true" /><input name="currency" type="hidden" value="RWF" /></label>
            </div>
            <label className="field"><span>Short description <em>Optional</em></span><textarea name="description" rows={3} maxLength={1000} placeholder="What is this agreement about?" /></label>
            <div className="form-divider" />
            <div className="form-section-title"><span className="section-number">2</span><div><h2>Set out the terms</h2><p>Write the key responsibilities and conditions in plain language.</p></div></div>
            <label className="field"><span>Agreement terms <b>*</b></span><textarea name="clauses" rows={9} minLength={10} maxLength={20000} required placeholder={"Describe what each party agrees to do.\n\nFor example:\n• What will be provided\n• When it will happen\n• Payment or other conditions"} /><small>Draft terms are private. Legal effect depends on applicable law and the specific agreement.</small></label>
            <div className="form-divider" />
            <div className="form-section-title"><span className="section-number">3</span><div><h2>Important dates</h2><p>Dates are optional and can be added later.</p></div></div>
            <div className="field-row">
              <label className="field"><span>Effective date <em>Optional</em></span><input name="effectiveDate" type="date" /></label>
              <label className="field"><span>Signing deadline <em>Optional</em></span><input name="signingDeadline" type="date" /></label>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions"><Link className="button button-quiet" href="/dashboard">Cancel</Link><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving draft…" : "Save draft"} <span aria-hidden="true">→</span></button></div>
          </form>
          <p className="legal-note">This platform facilitates agreement workflows; it is not a substitute for advice from a qualified professional.</p>
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { AgreementParties } from "@/lib/agreement-types";

type SigningAgreement = {
  id: string;
  status: string;
  publicReference: string;
  title: string;
  category: string;
  issuer: { legalName: string; email: string };
  versionNumber: number;
  contentHash: string;
  canonicalContent: {
    description?: string;
    clauses?: string;
    currency?: string;
    effectiveDate?: string | null;
    signingDeadline?: string | null;
    parties?: AgreementParties | null;
  };
  signatures: { role: string; signedName: string | null; signedAt: string | null }[];
};

type SigningSession = {
  signer: {
    id: string;
    name: string;
    email: string;
    signedAt: string | null;
  };
  agreement: SigningAgreement;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

export default function SignAgreementPage() {
  const params = useParams<{ token: string }>();
  const invitationToken = params.token;
  const [session, setSession] = useState<SigningSession | null>(null);
  const [code, setCode] = useState("");
  const [signedName, setSignedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [signedStatus, setSignedStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadInvitation() {
      try {
        const sessionResponse = await fetch(
          `/api/v1/signatures/session?token=${encodeURIComponent(invitationToken)}`
        );
        if (sessionResponse.ok) {
          const result = (await sessionResponse.json()) as SigningSession;
          if (active) {
            setSession(result);
            setSignedName(result.signer.name);
          }
          return;
        }
        if (sessionResponse.status !== 401) {
          const result = (await sessionResponse.json()) as { error?: string };
          throw new Error(result.error ?? "This signing invitation is unavailable.");
        }

        if (sessionResponse.status === 401) return;
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "This signing invitation could not be loaded.");
        }
      }
    }

    void loadInvitation();
    return () => {
      active = false;
    };
  }, [invitationToken]);

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/signatures/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invitationToken, code })
      });
      const result = (await response.json()) as SigningSession & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "We couldn’t verify that code.");
        return;
      }
      setSession(result);
      setSignedName(result.signer.name);
    } catch {
      setError("Connection problem. Your email could not be verified. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    setPending(true);
    setError("");
    setResendMessage("");
    try {
      const response = await fetch("/api/v1/signatures/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invitationToken })
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(result.error ?? "We couldn’t send another code.");
        return;
      }
      setResendMessage(result.message ?? "A new code was sent.");
    } catch {
      setError("Connection problem. A new code was not sent.");
    } finally {
      setPending(false);
    }
  }

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/signatures/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedName, consent })
      });
      const result = (await response.json()) as { signature?: { status: string }; error?: string };
      if (!response.ok) {
        setError(result.error ?? "Your signature could not be recorded.");
        return;
      }
      setSignedStatus(result.signature?.status ?? "PARTIALLY_SIGNED");
    } catch {
      setError("Connection problem. Your signature was not recorded. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const agreement = session?.agreement;
  const parties = agreement?.canonicalContent.parties;
  const isComplete = signedStatus === "FINALIZED";

  return (
    <main className="signing-page">
      <header className="signing-header">
        <Link className="brand" href="/"><span>AgreeIt</span></Link>
        <span className="eyebrow">PRIVATE SIGNING INVITATION</span>
      </header>
      <section className="signing-content">
        {signedStatus ? (
          <div className="signing-card">
            <span className="eyebrow">SIGNATURE RECORDED</span>
            <h1>{isComplete ? "Agreement complete." : "You’ve signed."}</h1>
            <p>{isComplete ? "Both parties have signed the same locked agreement version." : "Your signature is recorded. The agreement becomes final after the other party signs."}</p>
            {agreement && <p className="signing-reference">{agreement.publicReference} · {agreement.title}</p>}
            <p className="legal-note">This in-app signature is not a qualified digital signature or a guarantee of legal enforceability.</p>
          </div>
        ) : !session ? (
          <div className="signing-card">
            <span className="eyebrow">VERIFY YOUR EMAIL</span>
            <h1>Review and sign an agreement.</h1>
            <p>Enter the six-digit verification code sent to the email address named in the invitation. The code expires after 10 minutes.</p>
            <form className="signing-form" onSubmit={verifyEmail}>
              <label className="field"><span>One-time verification code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              {resendMessage && <p className="inline-notice" role="status">{resendMessage}</p>}
              <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Verifying…" : "Verify and continue"}</button>
              <button className="button button-quiet" type="button" onClick={resendCode} disabled={pending}>Send another code</button>
            </form>
          </div>
        ) : (
          <div className="signing-card">
            <span className="eyebrow">{agreement?.publicReference} · VERSION {agreement?.versionNumber}</span>
            <h1>{agreement?.title}</h1>
            <p>{agreement?.category} · Review the full locked version before signing.</p>
            <section className="review-card">
              <div className="review-grid">
                <div className="review-item"><small>PREPARED BY</small><strong>{agreement?.issuer.legalName}</strong><span>{agreement?.issuer.email}</span></div>
                <div className="review-item"><small>OTHER PARTY</small><strong>{parties?.counterpartyName}</strong><span>{parties?.counterpartyEmail}</span></div>
                <div className="review-item"><small>EFFECTIVE DATE</small><strong>{formatDate(agreement?.canonicalContent.effectiveDate)}</strong></div>
                <div className="review-item"><small>SIGNING DEADLINE</small><strong>{formatDate(agreement?.canonicalContent.signingDeadline)}</strong></div>
              </div>
              {agreement?.canonicalContent.description && <p className="preview-description">{agreement.canonicalContent.description}</p>}
              <h2>Agreement terms</h2>
              <div className="terms-text">{agreement?.canonicalContent.clauses ?? "No terms have been added."}</div>
              <div className="hash-row"><span>Locked content fingerprint</span><code>{agreement?.contentHash}</code></div>
            </section>
            <p className="legal-note">Email verification confirms access to this email account; it does not independently verify identity. The agreement is not final until both parties sign.</p>
            <form className="signing-form" onSubmit={sign}>
              <label className="field"><span>Type your name as shown on the agreement</span><input value={signedName} onChange={(event) => setSignedName(event.target.value)} minLength={2} maxLength={120} required /></label>
              <label className="confirm-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I have reviewed this exact version and intend to sign it using this typed name as my electronic signature.</span></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-primary" type="submit" disabled={!consent || pending}>{pending ? "Recording signature…" : "Sign agreement"}</button>
            </form>
          </div>
        )}
      </section>
      <footer className="signing-footer">Questions about this invitation? Contact the person who sent it. Do not share your verification code.</footer>
    </main>
  );
}

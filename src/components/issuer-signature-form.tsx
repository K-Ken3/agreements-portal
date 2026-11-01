"use client";

import { FormEvent, useState } from "react";

export function IssuerSignatureForm({
  agreementId,
  signerName,
  onSigned
}: {
  agreementId: string;
  signerName: string;
  onSigned: () => void;
}) {
  const [name, setName] = useState(signerName);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/agreements/${encodeURIComponent(agreementId)}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedName: name, consent })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Your signature could not be recorded.");
        return;
      }
      onSigned();
    } catch {
      setError("Connection problem. Your signature was not recorded. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="signature-action" onSubmit={submit}>
      <label className="field">
        <span>Type your legal name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required />
      </label>
      <label className="confirm-row">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I intend to sign this exact agreement version and agree to use this typed name as my electronic signature.</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={!consent || pending}>
        {pending ? "Recording signature…" : "Sign agreement"}
      </button>
    </form>
  );
}

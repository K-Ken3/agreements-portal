"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgreementDetail } from "@/lib/agreement-types";

/** Quick‑finalise button shown on a draft agreement.
 *  It performs the same validation the normal UI does, but in a single click.
 */
export default function QuickFinalise({ agreement }: { agreement: AgreementDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (agreement.status !== "DRAFT" || !agreement.parties) {
    // Nothing to do – the normal flow will handle it.
    return null;
  }

  async function handleFinalize() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/agreements/${encodeURIComponent(agreement.id)}/finalize`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not finalize agreement.");
        return;
      }
      // Success – go to the read‑only view.
      router.push(`/agreements/${agreement.id}`);
      router.refresh();
    } catch {
      setError("Network error while finalising.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="quick-finalise">
      {error && <p className="form-error">{error}</p>}
      <button
        className="button button-primary"
        onClick={handleFinalize}
        disabled={pending}
      >
        {pending ? "Finalising…" : "Finalize now"}
      </button>
    </div>
  );
}

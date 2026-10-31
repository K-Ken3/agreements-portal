"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      legalName: formData.get("legalName"),
      email: formData.get("email"),
      password: formData.get("password")
    };

    try {
      const response = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "We could not complete that request.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-decoration" aria-hidden="true">
        <div className="auth-decoration-circle" />
        <div className="auth-decoration-lines" />
      </div>
      <Link className="brand auth-brand" href="/">
        <span>AgreeIt</span>
      </Link>
      <section className="auth-card">
        <span className="eyebrow">{isRegister ? "GET STARTED" : "WELCOME BACK"}</span>
        <h1>{isRegister ? "Create your account" : "Sign in to your account"}</h1>
        <p className="auth-intro">
          {isRegister
            ? "A clear place to create and keep track of your agreements."
            : "Pick up where you left off with your agreements."}
        </p>
        <form className="form-stack" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="field">
              <span>Full legal name</span>
              <input name="legalName" autoComplete="name" required minLength={2} maxLength={120} />
            </label>
          )}
          <label className="field">
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 12 : 1}
              maxLength={128}
            />
            {isRegister && <small>Use at least 12 characters.</small>}
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={pending}>
            {pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            {!pending && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? "Already have an account?" : "New to AgreeIt?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {isRegister && (
          <p className="auth-legal">
            By creating an account, you acknowledge that our privacy and terms pages are drafts
            pending qualified legal review.
          </p>
        )}
      </section>
      <Link className="auth-back" href="/">← Back to home</Link>
    </main>
  );
}

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const steps = [
  {
    number: "01",
    title: "Set out the terms",
    description: "Start a draft with the details and responsibilities that matter to both parties."
  },
  {
    number: "02",
    title: "Review together",
    description: "Email a private invitation so the other party can verify their address and review the locked version."
  },
  {
    number: "03",
    title: "Sign the same version",
    description: "Both parties type their names and sign the same locked version to complete the record."
  }
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="AgreeIt home">
          <BrandLogo />
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#trust">Trust & privacy</a>
        </nav>
        <div className="header-actions">
          <Link className="button button-quiet" href="/login">Sign in</Link>
          <Link className="button button-primary button-small" href="/register">Get started</Link>
        </div>
      </header>

      <div className="release-notice" role="status">
        Set out the terms, invite the other party, and capture both parties’ typed in-app signatures.
      </div>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> CLEAR TERMS. SHARED CONFIDENCE.</span>
          <h1>Agreements should feel <span>clear from the start.</span></h1>
          <p>
            Bring the important details into one place. Create a draft, invite the other party
            to review and sign, and keep a record of each signature.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/register">
              Create an agreement <span aria-hidden="true">→</span>
            </Link>
            <a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-note">
            <span className="mini-shield" aria-hidden="true">✓</span>
            <span>Private by default <span className="note-separator">·</span> Built for both parties</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Illustration of an agreement document">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="document-card">
            <div className="document-top">
              <span className="document-icon">▤</span>
              <span className="document-menu">•••</span>
            </div>
            <span className="document-label">AGREEMENT DRAFT</span>
            <div className="document-title-line" />
            <div className="document-title-line short" />
            <div className="document-rule" />
            <div className="document-section-label">THE PARTIES</div>
            <div className="document-line" />
            <div className="document-line narrow" />
            <div className="document-section-label section-spaced">KEY TERMS</div>
            <div className="document-line" />
            <div className="document-line" />
            <div className="document-line narrow" />
            <div className="document-footer">
              <span><i className="status-dot" /> Saved as draft</span>
              <span>Version 01</span>
            </div>
          </div>
          <div className="floating-note">
            <span className="floating-check">✓</span>
            <span><strong>One shared record</strong><small>Every step, clearly tracked</small></span>
          </div>
          <div className="visual-caption">A clearer way to work through the details.</div>
        </div>
      </section>

      <section className="trust-strip" id="trust">
        <span className="trust-label">DESIGNED AROUND WHAT MATTERS</span>
        <div className="trust-item"><span className="trust-icon">⌑</span><span>Private by default</span></div>
        <div className="trust-item"><span className="trust-icon">↗</span><span>Clear version history</span></div>
        <div className="trust-item"><span className="trust-icon">◎</span><span>Built for both parties</span></div>
        <div className="trust-item"><span className="trust-icon">⌂</span><span>Rwanda-first, people-focused</span></div>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-heading">
          <span className="eyebrow">A THOUGHTFUL PROCESS</span>
          <h2>From first draft to two-party signatures.</h2>
          <p>Keep the process straightforward, and make the next step clear for everyone involved.</p>
        </div>
        <div className="step-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="disclaimer-band">
        <span className="disclaimer-mark">i</span>
        <p>
          AgreeIt helps parties organize agreements and records. It is not a law firm and
          does not guarantee that an agreement is enforceable. Get qualified advice when needed.
        </p>
        <Link href="/terms">Learn more <span aria-hidden="true">→</span></Link>
      </section>

      <footer className="site-footer">
        <Link className="brand footer-brand" href="/">
          <BrandLogo />
        </Link>
        <span className="footer-copy">A clearer way to make agreements.</span>
        <div className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <span className="copyright">© 2026 AgreeIt</span>
      </footer>
    </main>
  );
}

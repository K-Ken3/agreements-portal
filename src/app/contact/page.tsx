import Link from "next/link";

export default function ContactPage() {
  return <main className="legal-page"><Link className="brand" href="/"><span className="brand-mark">A</span><span>amasezerano</span></Link><span className="eyebrow">SUPPORT</span><h1>We’re building our support channels.</h1><p>Support contact details are not configured in this MVP. Please do not send personal, identity, or agreement information through an unconfigured channel.</p><p>For now, use the repository README and documentation for local setup and implementation details.</p><Link className="button button-outline" href="/">← Back to home</Link></main>;
}

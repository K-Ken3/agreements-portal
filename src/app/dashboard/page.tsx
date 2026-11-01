"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

type User = { legalName: string; email: string };
type Agreement = {
  id: string;
  publicReference: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const [meResponse, agreementsResponse] = await Promise.all([
          fetch("/api/v1/users/me"),
          fetch("/api/v1/agreements")
        ]);
        if (meResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!meResponse.ok || !agreementsResponse.ok) throw new Error("Unable to load your dashboard.");
        const me = (await meResponse.json()) as { user: User };
        const list = (await agreementsResponse.json()) as { agreements: Agreement[] };
        if (active) {
          setUser(me.user);
          setAgreements(list.agreements);
        }
      } catch {
        if (active) setError("We couldn’t load your agreements. Please refresh to try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  const visibleAgreements = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return agreements;
    return agreements.filter((agreement) =>
      `${agreement.title} ${agreement.category} ${agreement.publicReference}`.toLowerCase().includes(query)
    );
  }, [agreements, search]);

  const draftCount = agreements.filter((agreement) => agreement.status === "DRAFT").length;
  const completedCount = agreements.filter((agreement) => agreement.status === "FINALIZED").length;
  const pendingCount = agreements.filter((agreement) =>
    agreement.status === "LOCKED_FOR_SIGNING" || agreement.status === "PARTIALLY_SIGNED"
  ).length;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/">
          <BrandLogo />
        </Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav" aria-label="Workspace">
          <Link className="sidebar-link active" href="/dashboard"><span>▦</span> Overview</Link>
          <a className="sidebar-link" href="#agreements"><span>▤</span> Agreements</a>
          <button className="sidebar-link muted-link disabled-sidebar-link" type="button" disabled title="Recipient inbox is not available yet"><span>↙</span> Inbox <small>0</small></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span>?</span><div><strong>Need a hand?</strong><small>We’re here to help</small></div></div>
          <div className="user-mini">
            <span className="avatar">{user?.legalName?.slice(0, 1).toUpperCase() ?? "…"}</span>
            <div className="user-mini-copy"><strong>{user?.legalName ?? "Loading account"}</strong><small>{user?.email ?? ""}</small></div>
            <button className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>Overview</strong></div>
          <div className="topbar-actions"><span className="timezone-pill">Kigali · CAT</span><button className="notification-button" type="button" disabled aria-label="Notifications" title="Notifications are not available yet">♧</button></div>
        </header>
        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <span className="eyebrow">YOUR WORKSPACE</span>
              <h1>Good day{user ? `, ${user.legalName.split(" ")[0]}` : ""} <span className="wave">✳</span></h1>
              <p>Here’s what’s happening with your agreements.</p>
            </div>
            <Link className="button button-primary" href="/agreements/new">＋ New agreement</Link>
          </div>

          <div className="metric-grid">
            <article className="metric-card"><span className="metric-icon blue">▤</span><span className="metric-label">All agreements</span><strong>{loading ? "—" : agreements.length}</strong><small>Across your workspace</small></article>
            <article className="metric-card"><span className="metric-icon amber">◷</span><span className="metric-label">Drafts</span><strong>{loading ? "—" : draftCount}</strong><small>Ready when you are</small></article>
            <article className="metric-card"><span className="metric-icon green">✓</span><span className="metric-label">Completed</span><strong>{loading ? "—" : completedCount}</strong><small>Fully signed records</small></article>
            <article className="metric-card"><span className="metric-icon slate">↔</span><span className="metric-label">Awaiting signatures</span><strong>{loading ? "—" : pendingCount}</strong><small>Invited or partly signed</small></article>
          </div>

          <section className="agreements-panel" id="agreements">
            <div className="panel-heading">
              <div><h2>Your agreements</h2><p>Agreements you’ve created, all in one place.</p></div>
              <div className="list-tools">
                <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agreements" aria-label="Search agreements" /></label>
                <button className="filter-button" type="button" disabled title="Filtering will be available with agreement workflow support">Filter <span>⌄</span></button>
              </div>
            </div>
            {error ? <div className="inline-error" role="alert">{error}</div> : loading ? (
              <div className="list-loading">Loading your agreements…</div>
            ) : visibleAgreements.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">▤</span>
                <h3>{search ? "No matching agreements" : "Your workspace starts here"}</h3>
                <p>{search ? "Try another title or reference." : "Create a draft to start setting out terms clearly."}</p>
                {!search && <Link className="button button-outline" href="/agreements/new">Create your first agreement <span>→</span></Link>}
              </div>
            ) : (
              <div className="agreement-list">
                <div className="agreement-list-head"><span>AGREEMENT</span><span>REFERENCE</span><span>STATUS</span><span>LAST UPDATED</span><span /></div>
                {visibleAgreements.map((agreement) => {
                  const href = `/agreements/${agreement.id}`;
                  return (
                    <div
                      className="agreement-row"
                      key={agreement.id}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a, button")) return;
                        router.push(href);
                      }}
                    >
                      <Link className="agreement-title" href={href}>
                        <span className="agreement-file-icon">▤</span>
                        <span><strong>{agreement.title}</strong><small>{agreement.category}</small></span>
                      </Link>
                      <span className="reference-text">{agreement.publicReference}</span>
                      <span><span className={`status-badge status-${agreement.status.toLowerCase()}`}><i />{agreement.status.toLowerCase().replaceAll("_", " ")}</span></span>
                      <span className="date-text">{new Date(agreement.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      <span className="row-actions">
                        {agreement.status === "DRAFT" && <Link className="row-quick-action" href={`/agreements/${agreement.id}/edit`}>Edit</Link>}
                        <Link className="row-open-action" href={href} aria-label={`Open ${agreement.title}`}>Open <span aria-hidden="true">→</span></Link>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <p className="dashboard-disclaimer">AgreeIt helps organize agreement workflows and records. It does not provide legal advice.</p>
        </div>
      </section>
    </main>
  );
}

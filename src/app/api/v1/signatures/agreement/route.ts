import { AgreementSignerRole, AgreementStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { hashCanonicalContent } from "@/lib/agreements";
import { prisma } from "@/lib/prisma";
import { hashSigningSecret } from "@/lib/signing";

const SESSION_COOKIE = "agreement_signing_session";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
      });
}

function formatSignedAt(value: Date | null): string {
  return value
    ? value.toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "UTC"
      }) + " UTC"
    : "Not signed";
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const invitationToken = request.nextUrl.searchParams.get("token");
  if (!sessionToken || !invitationToken) {
    return NextResponse.json({ error: "Verify your email to access this agreement." }, { status: 401 });
  }

  const signer = await prisma.agreementSigner.findFirst({
    where: {
      sessionTokenHash: hashSigningSecret("session", sessionToken),
      invitationTokenHash: hashSigningSecret("invitation", invitationToken)
    },
    include: {
      agreement: {
        include: {
          issuer: { select: { legalName: true, email: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          signers: {
            select: { role: true, signedName: true, signedAt: true, signedContentHash: true }
          }
        }
      }
    }
  });
  const now = new Date();
  const completed = Boolean(
    signer?.signedAt && signer.agreement.status === AgreementStatus.FINALIZED
  );
  if (
    !signer ||
    signer.role !== AgreementSignerRole.COUNTERPARTY ||
    !signer.verifiedAt ||
    !signer.sessionExpiresAt ||
    signer.sessionExpiresAt <= now ||
    !completed
  ) {
    return NextResponse.json({ error: "The confirmed agreement is not available for this session." }, { status: 403 });
  }

  const version = signer.agreement.versions[0];
  const signaturesMatch = [AgreementSignerRole.ISSUER, AgreementSignerRole.COUNTERPARTY].every(
    (role) => signer.agreement.signers.some(
      (signature) =>
        signature.role === role &&
        signature.signedAt &&
        signature.signedContentHash === version?.contentHash
    )
  );
  if (
    !version?.isLocked ||
    hashCanonicalContent(version.canonicalContent) !== version.contentHash ||
    !signaturesMatch
  ) {
    return NextResponse.json({ error: "The agreement signatures could not be verified." }, { status: 409 });
  }

  const content =
    version.canonicalContent &&
    typeof version.canonicalContent === "object" &&
    !Array.isArray(version.canonicalContent)
      ? (version.canonicalContent as Prisma.JsonObject)
      : {};
  const parties =
    content.parties &&
    typeof content.parties === "object" &&
    !Array.isArray(content.parties)
      ? (content.parties as Prisma.JsonObject)
      : {};
  const issuerSignature = signer.agreement.signers.find(
    (signature) => signature.role === AgreementSignerRole.ISSUER
  );
  const counterpartySignature = signer.agreement.signers.find(
    (signature) => signature.role === AgreementSignerRole.COUNTERPARTY
  );
  const value = (key: string) => {
    const item = content[key];
    return typeof item === "string" ? item : "";
  };
  const partyValue = (key: string) => {
    const item = parties[key];
    return typeof item === "string" ? item : "";
  };
  const secondPartyDetails = [
    partyValue("counterpartyOrganization"),
    partyValue("counterpartyRole")
  ].filter(Boolean);
  const agreementTitle = escapeHtml(signer.agreement.title);
  const reference = escapeHtml(signer.agreement.publicReference);
  const fileReference = signer.agreement.publicReference.replace(/[^a-z0-9._-]/gi, "-");
  const logoUrl = escapeHtml(new URL("/agreeit-logo.png", request.nextUrl.origin).toString());
  const clauses = escapeHtml(value("clauses") || "No terms were recorded.");
  const description = value("description");
  const signatures = `
    <section class="signatures">
      <div><h2>First party</h2><strong>${escapeHtml(issuerSignature?.signedName ?? "")}</strong><p>${escapeHtml(signer.agreement.issuer.email)}</p><small>Signed ${escapeHtml(formatSignedAt(issuerSignature?.signedAt ?? null))}</small></div>
      <div><h2>Second party</h2><strong>${escapeHtml(counterpartySignature?.signedName ?? "")}</strong><p>${escapeHtml(partyValue("counterpartyEmail"))}</p><small>Signed ${escapeHtml(formatSignedAt(counterpartySignature?.signedAt ?? null))}</small></div>
    </section>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${reference} - ${agreementTitle}</title>
<style>
  :root{color:#1d2b37;font-family:Arial,Helvetica,sans-serif}
  body{margin:0;background:#f2f5f3}
  .toolbar{position:sticky;top:0;padding:14px;text-align:center;background:#fff;border-bottom:1px solid #dfe7e2}
  .toolbar button{padding:12px 20px;border:0;border-radius:6px;background:#087f43;color:#fff;font-size:15px;font-weight:700;cursor:pointer}
  article{box-sizing:border-box;max-width:820px;min-height:1056px;margin:28px auto;padding:64px 72px;background:#fff;box-shadow:0 4px 24px #1d344114}
  header{padding-bottom:24px;border-bottom:2px solid #087f43}
  .brand{display:flex;align-items:center;min-height:36px}
  .brand img{display:block;width:170px;height:auto}
  .label{margin-top:30px;color:#087f43;font-size:11px;font-weight:700;letter-spacing:1.6px}
  h1{margin:8px 0 0;font-size:30px;line-height:1.25}
  h2{margin:28px 0 10px;font-size:16px}
  p{line-height:1.7}
  .reference{color:#64737a;font-size:13px}
  .details{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:28px 0}
  .detail{padding:14px;border:1px solid #e4eae6;border-radius:5px}
  .detail small,.signatures small{display:block;color:#64737a;font-size:10px;font-weight:700;letter-spacing:.7px}
  .detail strong{display:block;margin-top:7px;font-size:13px}
  .clauses{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px}
  .signatures>div{min-height:130px;padding:16px;border:1px solid #e4eae6;border-radius:5px}
  .signatures h2{margin:0 0 28px}
  .signatures p{margin:6px 0 14px;font-size:12px}
  .hash{margin-top:30px;padding-top:14px;border-top:1px solid #e4eae6;color:#64737a;font-size:10px;overflow-wrap:anywhere}
  @media(max-width:640px){article{min-height:auto;margin:0;padding:32px 22px}.details,.signatures{grid-template-columns:1fr}}
  @media print{body{background:#fff}.toolbar{display:none}article{max-width:none;min-height:auto;margin:0;padding:0;box-shadow:none}.detail,.signatures>div{break-inside:avoid}h2{break-after:avoid}}
</style></head>
<body><div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<article>
  <header><div class="brand"><img src="${logoUrl}" alt="AgreeIt"></div><div class="label">CONFIRMED AGREEMENT</div><h1>${agreementTitle}</h1><p class="reference">Reference ${reference} · Version ${version.versionNumber}</p></header>
  <section class="details">
    <div class="detail"><small>FIRST PARTY</small><strong>${escapeHtml(signer.agreement.issuer.legalName)}</strong><span>${escapeHtml(signer.agreement.issuer.email)}</span></div>
    <div class="detail"><small>SECOND PARTY</small><strong>${escapeHtml(partyValue("counterpartyName"))}</strong>${secondPartyDetails.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("<br>")}<span>${escapeHtml(partyValue("counterpartyEmail"))}</span></div>
    <div class="detail"><small>EFFECTIVE DATE</small><strong>${escapeHtml(formatDate(content.effectiveDate))}</strong></div>
    <div class="detail"><small>SIGNING DEADLINE</small><strong>${escapeHtml(formatDate(content.signingDeadline))}</strong></div>
    <div class="detail"><small>AGREEMENT CATEGORY</small><strong>${escapeHtml(value("category") || signer.agreement.category)}</strong></div>
  </section>
  ${description ? `<h2>Agreement summary</h2><p>${escapeHtml(description)}</p>` : ""}
  <h2>Terms and conditions</h2><div class="clauses">${clauses}</div>
  <h2>Electronic signatures</h2>${signatures}
  <div class="hash">Locked agreement fingerprint (SHA-256): ${escapeHtml(version.contentHash)}<br>Each signature is bound to this exact agreement version.</div>
</article></body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="AgreeIt-${fileReference}.html"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    }
  });
}

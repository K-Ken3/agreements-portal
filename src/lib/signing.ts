import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function createSigningToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createSigningCode(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export function getPublicAppUrl(): URL {
  const configuredUrl =
    env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;
  const appUrl = configuredUrl
    ? new URL(
        configuredUrl.includes("://") ? configuredUrl : `https://${configuredUrl}`
      )
    : new URL("http://localhost:3000");

  if (
    process.env.NODE_ENV === "production" &&
    (appUrl.protocol !== "https:" ||
      appUrl.hostname === "localhost" ||
      appUrl.hostname === "127.0.0.1")
  ) {
    throw new EmailDeliveryError(
      "Set APP_URL to the public HTTPS URL of the deployed AgreeIt app in Vercel."
    );
  }
  return appUrl;
}

export function hashSigningSecret(purpose: string, value: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(`${purpose}:${value}`)
    .digest("hex");
}

export function matchesSigningSecret(
  purpose: string,
  value: string,
  expectedHash: string
): boolean {
  const actual = Buffer.from(hashSigningSecret(purpose, value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class EmailDeliveryError extends Error {}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendSigningInvitation(input: {
  email: string;
  signerName: string;
  issuerName: string;
  agreementTitle: string;
  publicReference: string;
  invitationToken: string;
  verificationCode: string;
  completedAgreementAccess?: boolean;
}): Promise<void> {
  if (!isEmailDeliveryConfigured()) {
    throw new EmailDeliveryError("Email delivery is not configured.");
  }

  const appUrl = getPublicAppUrl();
  const invitationUrl = new URL(
    `/sign/${encodeURIComponent(input.invitationToken)}`,
    appUrl
  ).toString();
  const logoUrl = new URL("/agreeit-logo.png", appUrl).toString();
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[character] ?? character);
  const completedAgreementAccess = input.completedAgreementAccess ?? false;
  const actionLabel = completedAgreementAccess
    ? "Open your confirmed agreement"
    : "Review and sign the agreement";
  const expiryNotice = completedAgreementAccess
    ? "This one-time code expires in 10 minutes."
    : "The code expires in 10 minutes. The invitation expires in 7 days or on the agreement's signing deadline, whichever comes first.";
  const text = [
    `Hello ${input.signerName},`,
    "",
    completedAgreementAccess
      ? `The agreement "${input.agreementTitle}" (${input.publicReference}) is now complete.`
      : `${input.issuerName} invited you to review and sign "${input.agreementTitle}" (${input.publicReference}).`,
    "",
    `${actionLabel}: ${invitationUrl}`,
    `Your one-time verification code is: ${input.verificationCode}`,
    "",
    expiryNotice,
    "If you were not expecting this invitation, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#1d2b37;font-family:Arial,sans-serif">
      <img src="${logoUrl}" alt="AgreeIt" width="180" style="display:block;width:180px;height:auto;margin:0 0 28px" />
      <p>Hello ${escapeHtml(input.signerName)},</p>
      <p>${completedAgreementAccess
        ? `Your agreement <strong>${escapeHtml(input.agreementTitle)}</strong> (${escapeHtml(input.publicReference)}) is complete and ready to view.`
        : `${escapeHtml(input.issuerName)} invited you to review and sign <strong>${escapeHtml(input.agreementTitle)}</strong> (${escapeHtml(input.publicReference)}).`}</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0">
        <tr>
          <td align="center" bgcolor="#087f43" style="border-radius:6px">
            <a href="${escapeHtml(invitationUrl)}" style="display:inline-block;padding:14px 22px;border:1px solid #087f43;border-radius:6px;background-color:#087f43;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;line-height:20px;text-align:center;text-decoration:none">${actionLabel}</a>
          </td>
        </tr>
      </table>
      <p>Your one-time verification code is:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:5px">${escapeHtml(input.verificationCode)}</p>
      <p style="color:#68777b;font-size:13px;line-height:1.6">${expiryNotice}</p>
      <p style="color:#68777b;font-size:13px">If you were not expecting this invitation, you can ignore this email.</p>
    </div>`;

  const requestId = randomUUID();
  console.info("Submitting agreement signing invitation to Resend.", { requestId });

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.email],
        subject: completedAgreementAccess
          ? `Your confirmed agreement: ${input.agreementTitle}`
          : `Review and sign: ${input.agreementTitle}`,
        text,
        html
      }),
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    console.error("Resend request failed before a response was received.", {
      requestId,
      errorType: error instanceof Error ? error.name : "UnknownError"
    });
    throw new EmailDeliveryError(
      "Our server could not connect to Resend. Check the Vercel function logs and try again."
    );
  }
  if (!response.ok) {
    let providerError = "unknown";
    try {
      const body: unknown = await response.clone().json();
      if (
        body &&
        typeof body === "object" &&
        "name" in body &&
        typeof body.name === "string" &&
        /^[a-z0-9_-]{1,60}$/i.test(body.name)
      ) {
        providerError = body.name;
      }
    } catch {
      // The response body is intentionally not logged; status and safe error code are sufficient.
    }

    console.error("Resend rejected the signing invitation.", {
      requestId,
      status: response.status,
      providerError
    });
    const message = response.status === 401
      ? "Resend rejected the API key. Check that the correct RESEND_API_KEY is set for this Vercel environment."
      : response.status === 403
        ? "Resend denied the request. Check the API key permissions and sender-domain verification."
        : response.status === 422
          ? "Resend rejected the sender or recipient. Check the sender address, verified domain, and recipient restrictions."
          : response.status === 429
            ? "Resend rate-limited this request. Wait a little and try again."
            : response.status >= 500
              ? "Resend is temporarily unavailable. Try again later."
              : "Resend rejected the invitation. Check the Vercel function logs for the provider status.";
    throw new EmailDeliveryError(message);
  }
}

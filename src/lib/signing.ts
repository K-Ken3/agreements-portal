import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function createSigningToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createSigningCode(): string {
  return randomInt(100_000, 1_000_000).toString();
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
}): Promise<void> {
  if (!isEmailDeliveryConfigured()) {
    throw new EmailDeliveryError("Email delivery is not configured.");
  }

  const invitationUrl = new URL(
    `/sign/${encodeURIComponent(input.invitationToken)}`,
    env.APP_URL
  ).toString();
  const text = [
    `Hello ${input.signerName},`,
    "",
    `${input.issuerName} invited you to review and sign "${input.agreementTitle}" (${input.publicReference}).`,
    "",
    `Open the secure signing page: ${invitationUrl}`,
    `Your one-time verification code is: ${input.verificationCode}`,
    "",
    "The code expires in 10 minutes. The invitation expires in 7 days or on the agreement's signing deadline, whichever comes first.",
    "If you were not expecting this invitation, you can ignore this email."
  ].join("\n");

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
        subject: `Review and sign: ${input.agreementTitle}`,
        text
      }),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new EmailDeliveryError("The invitation email could not be delivered.");
  }
  if (!response.ok) {
    throw new EmailDeliveryError("The invitation email could not be delivered.");
  }
}

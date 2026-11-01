import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);
const emailSender = z.string().trim().max(320).refine((value) => {
  const displayNameMatch = value.match(/^(?:"[^"]+"|[^<>]+)\s*<([^<>]+)>$/);
  const address = displayNameMatch?.[1] ?? value;
  return z.email().safeParse(address).success;
}, "Enter a sender email address, optionally with a display name.");
const optionalEmail = z.preprocess(
  (value) => (value === "" ? undefined : value),
  emailSender.optional()
);
const optionalAppUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  },
  z.string().url().optional()
);

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  SESSION_SECRET: z.string().min(32),
  APP_URL: optionalAppUrl,
  RESEND_API_KEY: optionalNonEmptyString,
  EMAIL_FROM: optionalEmail
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  APP_URL: process.env.APP_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM
});

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  SESSION_SECRET: z.string().min(32),
  APP_URL: z.string().url().default("http://localhost:3000")
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  APP_URL: process.env.APP_URL
});

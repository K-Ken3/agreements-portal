import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgreeIt — Agreements made clear",
  description:
    "Create, review, and keep track of agreements with a clear record for every party.",
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

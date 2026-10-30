import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "QuestKernel — Airdrop infrastructure",
  description:
    "Create verifiable wallet registration campaigns with real persistence, hard caps and a developer API.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

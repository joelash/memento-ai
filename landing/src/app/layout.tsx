import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "memable — Memory for AI Agents",
  description: "Production-grade semantic memory for AI agents. Python, TypeScript, and MCP support. Open source.",
  icons: {
    icon: `${basePath}/favicon.ico`,
  },
  openGraph: {
    title: "memable — Memory for AI Agents",
    description: "Production-grade semantic memory for AI agents. Works everywhere.",
    type: "website",
    images: [`${basePath}/memable-social-logo.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "memable — Memory for AI Agents",
    description: "Production-grade semantic memory for AI agents. Works everywhere.",
    images: [`${basePath}/memable-social-logo.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

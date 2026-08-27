import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Відмітка — розклад навчальних занять",
    template: "%s · Відмітка",
  },
  description:
    "Єдиний простір для перегляду та керування розкладом навчальних занять.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=vidmitka-1", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: "/icon.svg?v=vidmitka-1", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=vidmitka-1",
    apple: [{ url: "/apple-icon.png?v=vidmitka-1", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f2eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" data-scroll-behavior="smooth">
      <body>
        {children}
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}

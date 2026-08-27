import { Analytics } from "@vercel/analytics/next";
import { ukUA } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const ukrainianLocalization = {
  ...ukUA,
  formFieldInputPlaceholder__emailAddress: "Введіть адресу електронної пошти",
  formFieldInputPlaceholder__emailAddress_username:
    "Введіть адресу електронної пошти або ім’я користувача",
  formFieldInputPlaceholder__password: "Введіть пароль",
  formFieldInputPlaceholder__signUpPassword: "Створіть пароль",
  formFieldInputPlaceholder__username: "Введіть ім’я користувача",
};

export const metadata: Metadata = {
  title: {
    default: "Відмітка — розклад навчальних занять",
    template: "%s · Відмітка",
  },
  description:
    "Єдиний простір для перегляду та керування розкладом навчальних занять.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
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
        <ClerkProvider
          localization={ukrainianLocalization}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/"
        >
          {children}
          {process.env.VERCEL === "1" && <Analytics />}
        </ClerkProvider>
      </body>
    </html>
  );
}

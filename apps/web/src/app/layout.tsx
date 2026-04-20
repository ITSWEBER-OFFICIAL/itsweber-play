import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/toaster";
import { fetchTheme, buildThemeVarsCss } from "@/lib/theme-ssr";
import { CookieBanner } from "@/components/cookie-banner";
import { OnboardingTour } from "@/components/onboarding-tour";
import { WebVitalsReporter } from "@/components/web-vitals";
import {
  APP_NAME,
  AUTHOR_NAME,
  AUTHOR_URL,
  COPYRIGHT_NOTICE,
  VENDOR_NAME,
} from "@/lib/branding";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600", "700", "800"],
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500", "600"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Der etwas andere Video-Hub.",
  applicationName: APP_NAME,
  authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
  creator: AUTHOR_NAME,
  publisher: VENDOR_NAME,
  other: {
    copyright: COPYRIGHT_NOTICE,
    "designer": AUTHOR_NAME,
  },
  icons: {
    // `src/app/icon.svg` wird von Next automatisch als <link rel="icon"> für
    // moderne Browser eingezogen; hier explizite Fallbacks für Legacy/iOS.
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    shortcut: "/favicon.ico",
  },
  openGraph: {
    siteName: APP_NAME,
    locale: "de_DE",
    images: [
      {
        url: `${SITE_URL}/og-default.png`,
        width: 1200,
        height: 630,
        alt: APP_NAME,
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await fetchTheme();
  const themeVarsCss = buildThemeVarsCss(theme);
  // Wizard-Routen rendern fullscreen ohne SiteHeader/Footer/CookieBanner —
  // der Header zeigt sonst Login-Buttons + Suchleiste, die ein noch nicht
  // konfiguriertes Setup unzugänglich machen würden. Pfad kommt aus der
  // Middleware (siehe apps/web/src/middleware.ts).
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isWizardRoute = pathname === "/setup" || pathname.startsWith("/setup/");

  return (
    <html
      lang="de"
      // Browser-Extensions (Translator, Dark-Reader, Passwort-Manager) mutieren
      // häufig das <html>-Tag (lang="de-DE", injizierte styles, extra Attribute).
      // React kann das nicht reconcilen → suppressHydrationWarning nur hier, nicht
      // auf Children, damit echte Daten-Mismatches weiterhin gemeldet werden.
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Ebene-Reihenfolge (docs/03-theming.md): primitives + semantic kommen
            via globals.css → hier NACH ihnen: Admin-Overrides, dann Custom-CSS. */}
        {themeVarsCss && (
          <style
            id="theme-vars"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: themeVarsCss }}
          />
        )}
        {theme?.customCss && (
          <style
            id="theme-custom"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: theme.customCss }}
          />
        )}
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black focus:outline-none"
          >
            Springe zum Hauptinhalt
          </a>
          <ThemeSync />
          {!isWizardRoute && (
            <SiteHeader initialLogoUrl={theme?.logoUrl ?? null} />
          )}
          {/* flex-1-Wrapper: Body ist flex-col mit min-h-screen → Content dehnt
              sich bis zum Footer, Footer sitzt immer am unteren Viewport-Rand. */}
          <div className="flex-1">{children}</div>
          {!isWizardRoute && <SiteFooter />}
          {!isWizardRoute && <CookieBanner />}
          {!isWizardRoute && <OnboardingTour />}
          <WebVitalsReporter />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

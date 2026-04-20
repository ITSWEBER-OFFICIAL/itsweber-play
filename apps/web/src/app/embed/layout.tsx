import type { Metadata } from "next";
import { Providers } from "../providers";
import { ThemeSync } from "@/components/theme-sync";
import { fetchTheme, buildThemeVarsCss } from "@/lib/theme-ssr";
import { Geist } from "next/font/google";
import "../globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ITSWEBER Play",
};

export default async function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await fetchTheme();
  const themeVarsCss = buildThemeVarsCss(theme);

  return (
    <html lang="de" className={geist.variable}>
      <head>
        {themeVarsCss && (
          <style
            id="theme-vars"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: themeVarsCss }}
          />
        )}
      </head>
      <body className="m-0 overflow-hidden bg-black antialiased">
        <Providers>
          <ThemeSync />
          {children}
        </Providers>
      </body>
    </html>
  );
}

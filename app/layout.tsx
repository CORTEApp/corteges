import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SonnerProvider } from "@/components/providers/sonner-provider";

export const metadata: Metadata = {
  title: "CORTE.Ges",
  description: "Operativa interna de CORTE.Ges",
  icons: {
    icon: "/brand/corteges/logo-mark.svg",
    shortcut: "/brand/corteges/logo-mark.svg",
    apple: "/brand/corteges/logo-mark.svg",
  },
};

const uiSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-generated-sans",
});

const themeScript = `
(function () {
  var defaults = {
    themeMode: "system",
    themePreset: "saas_atlas_blue_v2",
    fontSize: "medium"
  };
  var preferences = defaults;
  try {
    var raw = window.localStorage.getItem("ui_preferences_v2");
    var stored = raw ? JSON.parse(raw) : null;
    if (stored && typeof stored === "object") {
      preferences = {
        themeMode: stored.themeMode === "light" || stored.themeMode === "dark" || stored.themeMode === "system" ? stored.themeMode : defaults.themeMode,
        themePreset: typeof stored.themePreset === "string" && stored.themePreset.trim() ? stored.themePreset : defaults.themePreset,
        fontSize: stored.fontSize === "small" || stored.fontSize === "medium" || stored.fontSize === "large" ? stored.fontSize : defaults.fontSize
      };
    }
    window.localStorage.setItem("ui_preferences_v2", JSON.stringify(preferences));
  } catch (error) {
    preferences = defaults;
  }
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var resolved = preferences.themeMode === "system" ? (prefersDark ? "dark" : "light") : preferences.themeMode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = preferences.themeMode;
  document.documentElement.dataset.themeResolved = resolved;
  document.documentElement.dataset.preset = preferences.themePreset;
  document.documentElement.dataset.fontSize = preferences.fontSize;
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={uiSans.variable}>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
        <SonnerProvider />
      </body>
    </html>
  );
}

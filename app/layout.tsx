import type { Metadata } from "next";
import "./globals.css";
import "@/packages/brand/theme.css";
import { SonnerProvider } from "@/components/providers/sonner-provider";

export const metadata: Metadata = {
  title: "CORTE.App Starter",
  description: "Starter generado por el sistema de agentes de CORTE.App con UI system interno",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <SonnerProvider />
      </body>
    </html>
  );
}

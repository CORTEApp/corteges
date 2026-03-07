import { AppShellSidebar01 } from "@/packages/blocks/app/app-shell-sidebar-01";

export default function AppSurfaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShellSidebar01
      brand="CORTE.App"
      navItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Automatizaciones", href: "/automatizaciones" },
        { label: "Clientes", href: "/clientes" },
        { label: "Ajustes", href: "/settings" },
      ]}
    >
      {children}
    </AppShellSidebar01>
  );
}

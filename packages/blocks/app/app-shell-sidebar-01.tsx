import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
};

type AppShellSidebar01Props = {
  brand: string;
  navItems: NavItem[];
  children: ReactNode;
};

export function AppShellSidebar01({
  brand,
  navItems,
  children,
}: AppShellSidebar01Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: "100vh",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid var(--border)",
          padding: "24px",
          background: "var(--card)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: "24px" }}>{brand}</div>
        <nav style={{ display: "grid", gap: "8px" }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: "none",
                color: "var(--foreground)",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid transparent",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}

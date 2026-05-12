import { AppShell } from "@/components/app/app-shell"

export default function AppSurfaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}

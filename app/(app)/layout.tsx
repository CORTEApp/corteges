import { AppShell } from "@/components/app/app-shell"
import { getAuthenticatedMembership } from "@/lib/users/server"

export default async function AppSurfaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const membership = await getAuthenticatedMembership("/clientes")

  return <AppShell roles={membership.roles}>{children}</AppShell>
}

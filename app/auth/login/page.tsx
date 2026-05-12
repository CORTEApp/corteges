import { LoginForm } from '@/components/auth/login-form'

function getSafeRedirectPath(rawNext: string | string[] | undefined) {
  const next = Array.isArray(rawNext) ? rawNext[0] : rawNext
  if (!next) return '/clientes'
  if (!next.startsWith('/')) return '/clientes'
  if (next.startsWith('//')) return '/clientes'
  return next
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}

  return (
    <main className="relative min-h-screen bg-background px-4 py-10 text-foreground">
      <LoginForm
        nextPath={getSafeRedirectPath(params.next)}
      />
    </main>
  )
}

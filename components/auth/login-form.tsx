'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FullScreenLoading } from '@/components/ui/full-screen-loading'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function LoginForm({
  defaultEmail = '',
  nextPath = '/clientes',
}: {
  defaultEmail?: string
  nextPath?: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      toast.error(error.message)
      return
    }

    toast.success('Dentro.')
    router.replace(nextPath)
    router.refresh()
  }

  async function handleRecoveryRequest() {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      toast.error('Introduce el email para enviar la recuperación.')
      return
    }

    setRecoveryLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/login` : undefined,
    })
    setRecoveryLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Te he enviado el enlace de recuperación.')
  }

  return (
    <>
      <FullScreenLoading
        active={loading || recoveryLoading}
        description={loading ? 'Validando credenciales y permisos.' : 'Solicitando enlace seguro.'}
        label={loading ? 'Entrando...' : 'Enviando recuperacion...'}
      />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Introduce tu email y contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordLogin}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
            <div className="mt-4 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-center"
                disabled={recoveryLoading || loading}
                onClick={handleRecoveryRequest}
              >
                {recoveryLoading ? 'Enviando...' : 'He olvidado mi contraseña'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

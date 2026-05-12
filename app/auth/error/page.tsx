import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthErrorPage() {
  return (
    <main className="relative min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No se pudo completar el acceso</CardTitle>
            <CardDescription>
              La sesión no se ha creado. Vuelve al acceso privado y entra con el usuario master.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/auth/login">Volver al acceso</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

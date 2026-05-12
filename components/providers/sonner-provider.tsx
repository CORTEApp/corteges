'use client'

import type { CSSProperties } from 'react'
import { Toaster } from 'sonner'

export function SonnerProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'skynet-toast',
        style: {
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
          boxShadow: '0 18px 45px -30px rgb(15 23 42 / 0.32)',
        } as CSSProperties,
      }}
    />
  )
}

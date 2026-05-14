"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { FullScreenLoading } from "@/components/ui/full-screen-loading"

export function FormSubmitButton({
  children,
  pendingLabel = "Procesando...",
  fullscreenPending = true,
  pendingDescription,
  pendingDelayMs,
  ...props
}: React.ComponentProps<typeof Button> & {
  pendingLabel?: string
  fullscreenPending?: boolean
  pendingDescription?: string
  pendingDelayMs?: number
}) {
  const { pending } = useFormStatus()

  return (
    <>
      <FullScreenLoading
        active={fullscreenPending && pending}
        delayMs={pendingDelayMs}
        description={pendingDescription}
        label={pendingLabel}
      />
      <Button {...props} type={props.type ?? "submit"} disabled={pending || props.disabled}>
        {pending ? pendingLabel : children}
      </Button>
    </>
  )
}

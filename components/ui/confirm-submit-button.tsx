"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { FullScreenLoading } from "@/components/ui/full-screen-loading"

export function ConfirmSubmitButton({
  children,
  pendingLabel = "Procesando...",
  fullscreenPending = true,
  pendingDescription,
  pendingDelayMs,
  title,
  description,
  confirmLabel,
  ...props
}: React.ComponentProps<typeof Button> & {
  pendingLabel?: string
  fullscreenPending?: boolean
  pendingDescription?: string
  pendingDelayMs?: number
  title: string
  description: string
  confirmLabel?: string
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
      <Button
        {...props}
        type={props.type ?? "submit"}
        disabled={pending || props.disabled}
        onClick={(event) => {
          props.onClick?.(event)
          if (event.defaultPrevented) {
            return
          }
          const label = confirmLabel ? `\n\n${confirmLabel}` : ""
          if (!window.confirm(`${title}\n\n${description}${label}`)) {
            event.preventDefault()
          }
        }}
      >
        {pending ? pendingLabel : children}
      </Button>
    </>
  )
}

"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

export function FormSubmitButton({
  children,
  pendingLabel = "Procesando...",
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus()

  return (
    <Button {...props} type={props.type ?? "submit"} disabled={pending || props.disabled}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

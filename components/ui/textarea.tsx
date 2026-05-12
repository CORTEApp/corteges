import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-32 w-full rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-2)] px-3.5 py-3 text-base text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] outline-none transition duration-150 placeholder:text-muted-foreground/80 hover:border-primary/25 hover:bg-[color:var(--surface-1)] focus:border-primary/45 focus:bg-[color:var(--field-filled)] disabled:cursor-not-allowed disabled:opacity-50 read-only:cursor-default read-only:bg-[color:var(--surface-3)] data-[filled=true]:border-primary/18 data-[filled=true]:bg-[color:var(--field-filled)] aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-2)] px-3.5 py-2.5 text-base text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] outline-none transition duration-150 selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 hover:border-primary/25 hover:bg-[color:var(--surface-1)] focus:border-primary/45 focus:bg-[color:var(--field-filled)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 read-only:cursor-default read-only:bg-[color:var(--surface-3)] data-[filled=true]:border-primary/18 data-[filled=true]:bg-[color:var(--field-filled)] md:text-sm",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }

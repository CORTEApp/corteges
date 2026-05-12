import * as React from "react"

import { cn } from "@/lib/utils"

type SelectOption = { value: string; label: string }

export function Select({
  options,
  placeholder,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[]
  placeholder?: string
  children?: React.ReactNode
}) {
  const selectedValue = props.value ?? props.defaultValue
  const isFilled = selectedValue !== undefined && selectedValue !== null && String(selectedValue).trim() !== ""

  return (
    <div className="relative w-full">
      <select
        data-filled={isFilled ? "true" : "false"}
        className={cn(
          "h-11 w-full appearance-none rounded-[var(--radius-panel)] border border-input/85 bg-[color:var(--surface-2)] px-3.5 py-2.5 pr-10 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] outline-none transition duration-150 hover:border-primary/25 hover:bg-[color:var(--surface-1)] focus:border-primary/45 focus:bg-[color:var(--field-filled)] disabled:cursor-not-allowed disabled:opacity-70 data-[filled=true]:border-primary/18 data-[filled=true]:bg-[color:var(--field-filled)]",
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children ??
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-foreground/65" aria-hidden>
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  )
}

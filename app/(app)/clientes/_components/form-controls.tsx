import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type FieldProps = {
  label: string
  name: string
  defaultValue?: string | number | null
  placeholder?: string
  type?: string
  inputMode?: "email" | "search" | "text" | "tel" | "url" | "none" | "numeric" | "decimal"
  required?: boolean
  className?: string
}

export function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  inputMode,
  required = false,
  className,
}: FieldProps) {
  return (
    <label className={className ?? "grid gap-2"}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Input
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        data-filled={defaultValue ? "true" : "false"}
      />
    </label>
  )
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
  className,
}: {
  label: string
  name: string
  defaultValue?: string | null
  placeholder?: string
  className?: string
}) {
  return (
    <label className={className ?? "grid gap-2"}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        data-filled={defaultValue ? "true" : "false"}
        className="min-h-24"
      />
    </label>
  )
}

export function SelectField({
  label,
  name,
  defaultValue,
  children,
  className,
}: {
  label: string
  name: string
  defaultValue?: string | null
  children: ReactNode
  className?: string
}) {
  return (
    <label className={className ?? "grid gap-2"}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Select
        name={name}
        defaultValue={defaultValue ?? ""}
        options={[]}
      >
        {children}
      </Select>
    </label>
  )
}

export function SectionTitle({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {note ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{note}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

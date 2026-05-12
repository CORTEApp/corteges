"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

export function FacturableCodeField({
  defaultValue,
  existingCodes,
  className,
}: {
  defaultValue?: string | null
  existingCodes: string[]
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const [value, setValue] = useState(defaultValue ?? "")
  const normalizedExistingCodes = useMemo(
    () => new Set(existingCodes.map(normalizeCode).filter(Boolean)),
    [existingCodes],
  )
  const normalizedValue = normalizeCode(value)
  const isDuplicate = normalizedValue.length > 0 && normalizedExistingCodes.has(normalizedValue)
  const message = isDuplicate ? `Ya existe un facturable con la denominación ${normalizedValue}.` : ""

  useEffect(() => {
    inputRef.current?.setCustomValidity(message)
  }, [message])

  return (
    <label className={cn("grid gap-2", className)}>
      <span className="text-sm font-medium text-foreground">Denominación</span>
      <Input
        ref={inputRef}
        name="code"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setValue((current) => normalizeCode(current))}
        placeholder="A-001"
        data-filled={value ? "true" : "false"}
        aria-invalid={isDuplicate || undefined}
        aria-describedby={isDuplicate ? errorId : undefined}
      />
      {isDuplicate ? (
        <p id={errorId} role="alert" className="text-xs font-medium leading-5 text-destructive">
          {message}
        </p>
      ) : null}
    </label>
  )
}

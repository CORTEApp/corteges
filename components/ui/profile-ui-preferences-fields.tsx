"use client"

import { useEffect, useState } from "react"

import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  FONT_SIZE_OPTIONS,
  THEME_MODE_OPTIONS,
  THEME_PRESET_OPTIONS,
  readStoredUiPreferences,
  saveUiPreferences,
  type FontSizePreference,
  type ThemeMode,
  type ThemePreset,
} from "@/lib/ui-preferences"

function normalizeThemePreset(value: string): ThemePreset {
  return THEME_PRESET_OPTIONS.some((item) => item.value === value)
    ? (value as ThemePreset)
    : THEME_PRESET_OPTIONS[0].value
}

function normalizeThemeMode(value: string): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system"
}

function normalizeFontSize(value: string): FontSizePreference {
  return value === "small" || value === "medium" || value === "large" ? value : "medium"
}

export function ProfileUiPreferencesFields({
  defaultThemePreset,
  defaultThemeMode,
  defaultFontSize,
}: {
  defaultThemePreset: string
  defaultThemeMode: string
  defaultFontSize: string
}) {
  const [themePreset, setThemePreset] = useState<ThemePreset>(normalizeThemePreset(defaultThemePreset))
  const [themeMode, setThemeMode] = useState<ThemeMode>(normalizeThemeMode(defaultThemeMode))
  const [fontSize, setFontSize] = useState<FontSizePreference>(normalizeFontSize(defaultFontSize))

  useEffect(() => {
    saveUiPreferences({
      themePreset,
      themeMode,
      fontSize,
    })
  }, [fontSize, themeMode, themePreset])

  function updatePreferences(patch: Partial<{ themePreset: ThemePreset; themeMode: ThemeMode; fontSize: FontSizePreference }>) {
    const stored = readStoredUiPreferences()
    const next = {
      themePreset: patch.themePreset ?? themePreset,
      themeMode: patch.themeMode ?? themeMode,
      fontSize: patch.fontSize ?? fontSize,
    }
    setThemePreset(next.themePreset ?? stored.themePreset)
    setThemeMode(next.themeMode ?? stored.themeMode)
    setFontSize(next.fontSize ?? stored.fontSize)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="preferred_theme">Tema visual</Label>
        <Select
          id="preferred_theme"
          name="preferred_theme"
          value={themePreset}
          options={THEME_PRESET_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(event) => updatePreferences({ themePreset: normalizeThemePreset(event.currentTarget.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color_mode">Modo visual</Label>
        <Select
          id="color_mode"
          name="color_mode"
          value={themeMode}
          options={THEME_MODE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(event) => updatePreferences({ themeMode: normalizeThemeMode(event.currentTarget.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="text_size">Tamaño del texto</Label>
        <Select
          id="text_size"
          name="text_size"
          value={fontSize}
          options={FONT_SIZE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(event) => updatePreferences({ fontSize: normalizeFontSize(event.currentTarget.value) })}
        />
      </div>
      <div className="rounded-[var(--radius-panel)] border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:col-span-2">
        Los cambios visuales se aplican al instante y además se guardan en tu perfil para futuras sesiones.
      </div>
    </div>
  )
}

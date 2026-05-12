export type ThemeMode = "light" | "dark" | "system"
export type ThemePreset =
  | "saas_atlas_blue_v2"
  | "saas_cobalt_sand_v2"
  | "saas_ember_slate_v2"
  | "saas_olive_stone_v2"
export type FontSizePreference = "small" | "medium" | "large"

export type UiPreferences = {
  themeMode: ThemeMode
  themePreset: ThemePreset
  fontSize: FontSizePreference
}

export const UI_PREFERENCES_STORAGE_KEY = "ui_preferences_v2"
export const UI_PREFERENCES_EVENT = "ui-preferences-changed"

export const THEME_PRESET_OPTIONS = [
  { value: "saas_atlas_blue_v2", label: "SaaS Atlas Blue v2" },
  { value: "saas_cobalt_sand_v2", label: "SaaS Cobalt Sand v2" },
  { value: "saas_ember_slate_v2", label: "SaaS Ember Slate v2" },
  { value: "saas_olive_stone_v2", label: "SaaS Olive Stone v2" },
] as const

export const THEME_MODE_OPTIONS = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
] as const

export const FONT_SIZE_OPTIONS = [
  { value: "small", label: "Compacto" },
  { value: "medium", label: "Normal" },
  { value: "large", label: "Grande" },
] as const

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  themeMode: "system",
  themePreset: "saas_atlas_blue_v2",
  fontSize: "medium",
}

const VALID_THEME_PRESETS = new Set<string>(THEME_PRESET_OPTIONS.map((item) => item.value))

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : DEFAULT_UI_PREFERENCES.themeMode
}

function normalizeThemePreset(value: unknown): ThemePreset {
  return typeof value === "string" && VALID_THEME_PRESETS.has(value)
    ? (value as ThemePreset)
    : DEFAULT_UI_PREFERENCES.themePreset
}

function normalizeFontSize(value: unknown): FontSizePreference {
  return value === "small" || value === "medium" || value === "large"
    ? value
    : DEFAULT_UI_PREFERENCES.fontSize
}

export function normalizeUiPreferences(value: unknown): UiPreferences {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    themeMode: normalizeThemeMode(data.themeMode),
    themePreset: normalizeThemePreset(data.themePreset),
    fontSize: normalizeFontSize(data.fontSize),
  }
}

export function resolveTheme(preferences: UiPreferences) {
  if (preferences.themeMode === "system") {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark"
    }
    return "light"
  }
  return preferences.themeMode
}

export function applyUiPreferences(preferences: UiPreferences) {
  if (typeof document === "undefined") {
    return preferences
  }

  const normalized = normalizeUiPreferences(preferences)
  const resolvedTheme = resolveTheme(normalized)
  const root = document.documentElement
  root.classList.toggle("dark", resolvedTheme === "dark")
  root.dataset.theme = resolvedTheme
  root.dataset.themeMode = normalized.themeMode
  root.dataset.themeResolved = resolvedTheme
  root.dataset.preset = normalized.themePreset
  root.dataset.fontSize = normalized.fontSize
  return normalized
}

export function readStoredUiPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_UI_PREFERENCES
  }

  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)
    return normalizeUiPreferences(raw ? JSON.parse(raw) : DEFAULT_UI_PREFERENCES)
  } catch {
    return DEFAULT_UI_PREFERENCES
  }
}

export function saveUiPreferences(preferences: UiPreferences) {
  const normalized = normalizeUiPreferences(preferences)
  if (typeof window !== "undefined") {
    window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized))
    applyUiPreferences(normalized)
    window.dispatchEvent(new CustomEvent(UI_PREFERENCES_EVENT, { detail: normalized }))
  }
  return normalized
}

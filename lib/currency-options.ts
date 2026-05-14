export const supportedCurrencyCodes = ["EUR", "USD", "GBP"] as const

export type SupportedCurrencyCode = (typeof supportedCurrencyCodes)[number]

export const currencyOptions = [
  { value: "EUR", label: "EUR - Euro" },
  { value: "USD", label: "USD - Dolar estadounidense" },
  { value: "GBP", label: "GBP - Libra esterlina" },
] satisfies Array<{ value: SupportedCurrencyCode; label: string }>

const supportedCurrencySet = new Set<string>(supportedCurrencyCodes)

export function normalizeCurrencyCode(value: string | null | undefined): SupportedCurrencyCode | null {
  const normalized = value?.trim().toUpperCase()
  return normalized && supportedCurrencySet.has(normalized) ? (normalized as SupportedCurrencyCode) : null
}

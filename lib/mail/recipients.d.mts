import type { MicrosoftMailRecipient } from "@/lib/microsoft/graph"

export function splitMailRecipients(values: Array<string | null | undefined> | null | undefined): string[]
export function mailRecipientList(values: Array<string | null | undefined> | null | undefined): MicrosoftMailRecipient[]

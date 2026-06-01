const RECIPIENT_SEPARATOR = /[;,\r\n]+/g

export function splitMailRecipients(values) {
  const seen = new Set()
  const recipients = []

  for (const value of values ?? []) {
    for (const rawRecipient of String(value ?? "").split(RECIPIENT_SEPARATOR)) {
      const email = rawRecipient.trim()
      if (!email) {
        continue
      }

      const dedupeKey = email.toLowerCase()
      if (seen.has(dedupeKey)) {
        continue
      }

      seen.add(dedupeKey)
      recipients.push(email)
    }
  }

  return recipients
}

export function mailRecipientList(values) {
  return splitMailRecipients(values).map((email) => ({ email }))
}

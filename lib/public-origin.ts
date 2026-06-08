function isPrivateHostname(hostname: string) {
  return (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0"
    || hostname.startsWith("10.")
    || hostname.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

function isPrivateOrigin(origin: string) {
  try {
    return isPrivateHostname(new URL(origin).hostname)
  } catch {
    return false
  }
}

function configuredPublicOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.MICROSOFT_GRAPH_REDIRECT_BASE_URL ??
    ""

  if (!raw.trim()) {
    return ""
  }

  try {
    return new URL(raw.trim()).origin
  } catch {
    return ""
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? ""
}

export function getPublicOrigin(request: Request) {
  const requestUrl = new URL(request.url)
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"))
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"))
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"))
  const configured = configuredPublicOrigin()

  if (configured && !isPrivateOrigin(configured)) {
    return configured
  }

  if (host) {
    const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, "") || "https"
    return `${protocol}://${host}`
  }

  if (configured) {
    return configured
  }

  return requestUrl.origin
}

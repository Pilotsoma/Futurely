/** Adds https:// when missing and strips trailing slashes from a hand-typed Canvas URL. */
export function normalizeCanvasUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  return withProtocol.replace(/\/+$/, '')
}

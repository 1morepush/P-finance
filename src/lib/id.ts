/**
 * A unique id for a locally-created record.
 *
 * `crypto.randomUUID` is absent on Safari before 15.4 and on any non-secure
 * origin, and every record the app creates goes through here — so a missing
 * implementation would not degrade a feature, it would throw the moment you
 * logged a payment. The fallback only has to be unique within one device's
 * storage, which random bits plus the clock comfortably are.
 */
export function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16))
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

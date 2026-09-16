/**
 * Getting a file out of the app on a phone.
 *
 * A download link is the least reliable route on iOS, and inside a
 * home-screen app it often does nothing at all. The share sheet is the one
 * that actually reaches Files, Mail and AirDrop, so it is tried first; the
 * download is the fallback; and copying to the clipboard is the route that
 * works when neither does.
 */
export type Delivery = 'shared' | 'downloaded' | 'cancelled'

export async function deliverFile(name: string, text: string, type: string): Promise<Delivery> {
  const file = new File([text], name, { type })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name })
      return 'shared'
    } catch (err) {
      // The user closed the sheet. Not a failure, and not a reason to also
      // trigger a download they did not ask for.
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

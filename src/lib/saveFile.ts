/**
 * Saves a text file. Inside a Claude artifact pages cannot start downloads themselves, so the
 * file goes through the viewer's `downloads` capability (it asks you to confirm). Elsewhere a
 * plain link click does it.
 */
export async function saveTextFile(filename: string, text: string, type = 'application/json') {
  const use = typeof window !== 'undefined' ? window.claude?.use : undefined
  if (typeof use === 'function') {
    try {
      const dl = (await use.call(window.claude, 'downloads')) as { save(r: { filename: string; data: string }): Promise<unknown> } | null
      if (dl) {
        await dl.save({ filename, data: text })
        return
      }
    } catch {
      // Declined or unavailable: nothing to do, the viewer saw the dialog (or none exists).
      return
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

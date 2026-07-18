export function fmtTime(ms) {
  const t = Math.max(0, Math.floor(ms))
  const tenths = Math.floor((t % 1000) / 100)
  const totalSec = Math.floor(t / 1000)
  const sec = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`
  }
  return `${totalMin}:${String(sec).padStart(2, '0')}.${tenths}`
}

export function guessCountry() {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || ''
    const m = loc.match(/-([A-Z]{2})\b/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

export function countryFlag(code) {
  if (!code || code.length !== 2) return ''
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
  } catch {
    return ''
  }
}

export function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern)
  } catch {
    /* no haptics, no bother */
  }
}

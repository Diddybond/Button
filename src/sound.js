// Synthesised sound effects via Web Audio — no files, no loading, no fuss.
// Everything routes through one lazily-created AudioContext (browsers only
// allow audio after a user gesture, which a hold game has in abundance).

let ctx = null
let muted = localStorage.getItem('htb_muted') === '1'

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function isMuted() {
  return muted
}

export function toggleMuted() {
  muted = !muted
  localStorage.setItem('htb_muted', muted ? '1' : '0')
  return muted
}

// One note: freq (Hz), dur (s), optional glide target, waveform, volume, delay
function tone(freq, dur, { to, type = 'sine', vol = 0.15, at = 0 } = {}) {
  const c = ac()
  if (!c || muted) return
  try {
    const t0 = c.currentTime + at
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(c.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  } catch { /* audio is a garnish, never a crash */ }
}

export const sfx = {
  // Finger lands on the button: a solid little thump
  press() {
    tone(150, 0.09, { to: 70, type: 'square', vol: 0.12 })
  },
  // Run over: a descending womp of disappointment
  death() {
    tone(320, 0.35, { to: 80, type: 'sawtooth', vol: 0.14 })
    tone(160, 0.45, { to: 50, type: 'sine', vol: 0.12, at: 0.05 })
  },
  // Milestone: a dry blip
  milestone() {
    tone(660, 0.07, { type: 'triangle', vol: 0.08 })
  },
  // Fake notification: an annoyingly convincing two-note ding
  notif() {
    tone(880, 0.08, { type: 'sine', vol: 0.1 })
    tone(1174, 0.12, { type: 'sine', vol: 0.1, at: 0.09 })
  },
  // Something good: beat a mate, posted a score, personal best
  win() {
    tone(523, 0.09, { type: 'triangle', vol: 0.11 })
    tone(659, 0.09, { type: 'triangle', vol: 0.11, at: 0.09 })
    tone(784, 0.16, { type: 'triangle', vol: 0.12, at: 0.18 })
  },
  // The button is up to something (gag kicking in)
  gag() {
    tone(300, 0.1, { to: 520, type: 'sine', vol: 0.07 })
  },
}

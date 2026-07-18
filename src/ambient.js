// Procedural ambient soundtrack — no files, generated live with Web Audio.
// Slow detuned pads cycling a minor progression; the filter creeps open as
// the hold gets longer, so long runs feel like something is building.

import { audioCtx, isMuted } from './sound.js'

// Low, moody voicings: Am, F, C, G — each [root, fifth, octave-ish colour]
const CHORDS = [
  [110.0, 164.81, 220.0, 261.63],
  [87.31, 130.81, 174.61, 220.0],
  [98.0, 146.83, 196.0, 246.94],
  [82.41, 123.47, 164.81, 207.65],
]

let running = null // { master, filter, timer, active: [] }

function playChord(ctx, dest, freqs, dur) {
  const oscs = []
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(1, t + 2.5)
  g.gain.setValueAtTime(1, t + dur - 3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  g.connect(dest)
  for (const f of freqs) {
    for (const detune of [-4, 4]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = detune
      o.connect(g)
      o.start(t)
      o.stop(t + dur + 0.1)
      oscs.push(o)
    }
  }
  return oscs
}

export function startMusic() {
  if (running || isMuted()) return
  const ctx = audioCtx()
  if (!ctx) return
  try {
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 3)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380
    filter.Q.value = 0.8
    filter.connect(master)
    master.connect(ctx.destination)

    const state = { master, filter, timer: null, active: [], i: 0 }
    const step = () => {
      state.active = playChord(ctx, filter, CHORDS[state.i % CHORDS.length], 10)
      state.i += 1
      state.timer = setTimeout(step, 8000) // 2s crossfade overlap
    }
    step()
    running = state
  } catch { /* no music, no matter */ }
}

export function stopMusic() {
  if (!running) return
  const ctx = audioCtx()
  const { master, timer } = running
  running = null
  clearTimeout(timer)
  try {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(master.gain.value || 0.03, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
    setTimeout(() => { try { master.disconnect() } catch { /* done */ } }, 1500)
  } catch { /* already gone */ }
}

// 0 = calm start, 1 = deep into the hold. Opens the filter and lifts volume.
export function setMusicIntensity(p) {
  if (!running) return
  const ctx = audioCtx()
  try {
    running.filter.frequency.linearRampToValueAtTime(380 + p * 1100, ctx.currentTime + 0.5)
    running.master.gain.linearRampToValueAtTime(0.035 + p * 0.02, ctx.currentTime + 0.5)
  } catch { /* fine */ }
}

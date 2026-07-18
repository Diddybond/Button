import { useEffect, useRef, useState, useCallback } from 'react'
import Results from './Results.jsx'
import Leaderboard from './Leaderboard.jsx'
import { fmtTime, vibrate } from './format.js'
import { drawNotification } from './notifications.js'
import { supabase, fetchKing } from './supabase.js'
import { sfx, isMuted, toggleMuted } from './sound.js'
import { startMusic, stopMusic, setMusicIntensity } from './ambient.js'

const MILESTONES = [
  { at: 5_000, text: 'off you go then', buzz: 20 },
  { at: 15_000, text: 'warming up', buzz: 20 },
  { at: 30_000, text: 'you can stop whenever you like. just saying', buzz: 20 },
  { at: 45_000, text: 'the button is getting restless', buzz: 20 },
  { at: 60_000, text: "now we're talking", buzz: [20, 40, 20] },
  { at: 75_000, text: 'a minute and a quarter of your one wild life', buzz: 20 },
  { at: 90_000, text: 'your thumb is earning its keep', buzz: 20 },
  { at: 105_000, text: 'just let go. nobody would blame you', buzz: 20 },
  { at: 120_000, text: 'ignore your phone. obviously', buzz: 20 },
  { at: 150_000, text: 'you do realise this achieves nothing', buzz: 20 },
  { at: 180_000, text: 'this hold sponsored by Rifkin & Livesey, who photograph things that stay still better than you', buzz: [20, 40, 20] },
  { at: 210_000, text: 'imagine explaining this at work tomorrow', buzz: 20 },
  { at: 240_000, text: 'your tea has gone cold, by the way', buzz: 20 },
  { at: 270_000, text: 'quitting is free, you know', buzz: 20 },
  { at: 300_000, text: 'go on then', buzz: [20, 40, 20] },
  { at: 360_000, text: 'six minutes of holding a pretend button', buzz: 20 },
  { at: 420_000, text: 'the kettle boiled ages ago', buzz: 20 },
  { at: 480_000, text: 'this is between you and the button now', buzz: 20 },
  { at: 600_000, text: 'have you nothing better to do', buzz: [20, 40, 20] },
  // Past 10 minutes the button starts talking. It has been thinking.
  { at: 660_000, text: '"I don\'t even feel pressed any more" — the button', buzz: 20 },
  { at: 720_000, text: "we've run out of nice things to say", buzz: 20 },
  { at: 780_000, text: '"we could do this forever, you and me" — the button', buzz: 20 },
  { at: 840_000, text: '"your thumb is warm. I like that" — the button', buzz: 20 },
  { at: 900_000, text: 'genuinely impressed. slightly worried', buzz: 20 },
  { at: 960_000, text: '"the others always let go. you\'re different" — the button', buzz: 20 },
  { at: 1_080_000, text: '"I\'ve started telling the other buttons about you" — the button', buzz: 20 },
  { at: 1_200_000, text: 'your ancestors crossed oceans for this', buzz: 20 },
  { at: 1_320_000, text: '"blink twice if you\'re holding me against your will" — the button', buzz: 20 },
  { at: 1_500_000, text: '"I used to be a lift button. we don\'t talk about it" — the button', buzz: 20 },
  { at: 1_650_000, text: '"they\'ll write about us, you know" — the button', buzz: 20 },
  { at: 1_800_000, text: 'put it down and go outside', buzz: [40, 60, 40] },
]

const GAG_TYPES = ['ghost', 'disco', 'liar', 'decoy', 'gravity']

// Cinematic backdrop art, fetched AFTER first paint so load stays instant
const CINE_BG = 'https://d8j0ntlcm91z4.cloudfront.net/user_39p5yo8k7I2G83SENqXCUdgvNPZ/hf_20260718_150720_40728716-2ebb-4fde-a50a-a574d2f182f3_min.webp'

function parseChallenge() {
  try {
    const p = new URLSearchParams(window.location.search)
    const beat = parseInt(p.get('beat'), 10)
    if (!beat || beat < 1000 || beat > 86_400_000) return null
    let from = (p.get('from') || 'A mate').slice(0, 12)
    if (!/^[A-Za-z0-9 _\-.]+$/.test(from)) from = 'A mate'
    return { beat, from }
  } catch {
    return null
  }
}

// The button's face. It has feelings, and they deteriorate.
function Face({ mood }) {
  const S = 'rgba(80, 16, 5, 0.85)'
  return (
    <svg className="face" viewBox="0 0 100 60" aria-hidden="true">
      {mood === 'happy' && (<>
        <circle className="blink" cx="32" cy="24" r="5" fill={S} />
        <circle className="blink" cx="68" cy="24" r="5" fill={S} />
        <path d="M30 38 Q50 52 70 38" stroke={S} strokeWidth="5" fill="none" strokeLinecap="round" />
      </>)}
      {mood === 'focused' && (<>
        <ellipse className="blink" cx="32" cy="24" rx="6" ry="2.5" fill={S} />
        <ellipse className="blink" cx="68" cy="24" rx="6" ry="2.5" fill={S} />
        <path d="M34 42 L66 42" stroke={S} strokeWidth="5" fill="none" strokeLinecap="round" />
      </>)}
      {mood === 'worried' && (<>
        <circle className="blink" cx="32" cy="24" r="6" fill={S} />
        <circle className="blink" cx="68" cy="24" r="6" fill={S} />
        <path d="M30 44 Q40 37 50 44 Q60 51 70 44" stroke={S} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      </>)}
      {mood === 'mischief' && (<>
        <path d="M24 16 L40 20" stroke={S} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="32" cy="26" rx="5" ry="4" fill={S} />
        <circle className="blink" cx="68" cy="24" r="5" fill={S} />
        <path d="M30 42 Q55 52 70 36" stroke={S} strokeWidth="5" fill="none" strokeLinecap="round" />
      </>)}
      {mood === 'panic' && (<>
        <circle cx="32" cy="22" r="8" fill="#fff" opacity="0.9" />
        <circle cx="32" cy="22" r="3" fill={S} />
        <circle cx="68" cy="22" r="8" fill="#fff" opacity="0.9" />
        <circle cx="68" cy="22" r="3" fill={S} />
        <ellipse cx="50" cy="44" rx="8" ry="10" fill={S} />
      </>)}
      {mood === 'angry' && (<>
        <path d="M22 14 L40 22" stroke={S} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M78 14 L60 22" stroke={S} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="32" cy="27" r="4.5" fill={S} />
        <circle cx="68" cy="27" r="4.5" fill={S} />
        <path d="M30 48 Q50 36 70 48" stroke={S} strokeWidth="5" fill="none" strokeLinecap="round" />
      </>)}
      {mood === 'unhinged' && (<>
        <path d="M26 18 L38 30 M38 18 L26 30" stroke={S} strokeWidth="4" strokeLinecap="round" />
        <circle cx="68" cy="24" r="8" fill="none" stroke={S} strokeWidth="3.5" />
        <circle cx="68" cy="24" r="2.5" fill={S} />
        <path d="M28 44 L38 40 L46 47 L56 39 L64 46 L72 41" stroke={S} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>)}
    </svg>
  )
}

function readStreak() {
  return {
    day: localStorage.getItem('htb_last_day') || '',
    n: Number(localStorage.getItem('htb_streak')) || 0,
  }
}

export default function App() {
  const [screen, setScreen] = useState('game') // game | results | board
  const [mode, setMode] = useState('solo') // solo | duo
  const [holding, setHolding] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [milestone, setMilestone] = useState(null)
  const [notifs, setNotifs] = useState([])
  const [gag, setGag] = useState(null) // { type, until, x, y }
  const [lastRun, setLastRun] = useState(null) // { ms, reason, mode, challenge }
  const [best, setBest] = useState(() => Number(localStorage.getItem('htb_best')) || 0)
  const [streak, setStreak] = useState(() => readStreak().n)
  const [holders, setHolders] = useState(0)
  const [king, setKing] = useState(null)
  const [muted, setMuted] = useState(isMuted)
  const [challenge] = useState(parseChallenge)

  const startRef = useRef(0)
  const rafRef = useRef(0)
  const holdingRef = useRef(false)
  const heldRef = useRef({})
  const modeRef = useRef('solo')
  const milestoneIdxRef = useRef(0)
  const nextNotifRef = useRef(0)
  const notifIdRef = useRef(0)
  const nextGagRef = useRef(0)
  const beatCrossedRef = useRef(false)
  const channelRef = useRef(null)
  const pointerPosRef = useRef({}) // pointerId -> { x, y }
  const lastSlipCheckRef = useRef(0)
  const strayDetailRef = useRef(null)
  modeRef.current = mode

  const [cineBg, setCineBg] = useState(null)

  // Lazy-load the cinematic backdrop once the page has settled; the CSS
  // scene shows instantly and this fades in over it when ready
  useEffect(() => {
    const t = setTimeout(() => {
      const img = new Image()
      img.onload = () => setCineBg(CINE_BG)
      img.src = CINE_BG
    }, 700)
    return () => clearTimeout(t)
  }, [])

  // King of the Hour, refreshed whenever the home screen shows
  useEffect(() => {
    if (screen !== 'game' || holding) return
    fetchKing().then(setKing).catch(() => {})
  }, [screen, holding])

  // Live presence: how many thumbs are on buttons right now, worldwide
  useEffect(() => {
    let channel
    try {
      channel = supabase.channel('htb-holders', {
        config: { presence: { key: Math.random().toString(36).slice(2) } },
      })
      channel
        .on('presence', { event: 'sync' }, () => {
          try { setHolders(Object.keys(channel.presenceState()).length) } catch { /* ignore */ }
        })
        .subscribe()
      channelRef.current = channel
    } catch { /* leaderboard offline — presence is decoration */ }
    return () => { try { channel?.unsubscribe() } catch { /* ignore */ } }
  }, [])

  const endRun = useCallback((reason) => {
    if (!holdingRef.current) return
    const ms = performance.now() - startRef.current
    holdingRef.current = false
    heldRef.current = {}
    cancelAnimationFrame(rafRef.current)
    setHolding(false)
    setNotifs([])
    setMilestone(null)
    setGag(null)
    try { channelRef.current?.untrack() } catch { /* ignore */ }
    stopMusic()

    if (ms < 50 && reason === 'release') {
      // Accidental tap: no run, no fuss
      setElapsed(0)
      return
    }
    const final = Math.floor(ms)
    const detail = reason === 'release' ? 'simply let go'
      : reason === 'slip' ? 'slid off the button'
      : reason === 'focus' ? 'looked away'
      : (strayDetailRef.current || 'touched something that was not the button')
    strayDetailRef.current = null
    sfx.death()
    setLastRun({ ms: final, reason, detail, mode: modeRef.current, challenge })
    if (modeRef.current === 'solo' && final > best) {
      setBest(final)
      localStorage.setItem('htb_best', String(final))
    }
    if (final >= 1000) {
      // Daily streak: one qualifying hold per day keeps the flame lit
      const today = new Date().toDateString()
      const yesterday = new Date(Date.now() - 86_400_000).toDateString()
      const s = readStreak()
      if (s.day !== today) {
        const n = s.day === yesterday ? s.n + 1 : 1
        localStorage.setItem('htb_last_day', today)
        localStorage.setItem('htb_streak', String(n))
        setStreak(n)
      }
    }
    vibrate([30, 50, 30])
    setScreen('results')
  }, [best, challenge])

  const endRunRef = useRef(endRun)
  endRunRef.current = endRun

  const tick = useCallback(() => {
    if (!holdingRef.current) return
    const ms = performance.now() - startRef.current
    setElapsed(ms)

    // Milestone messages + haptics
    const next = MILESTONES[milestoneIdxRef.current]
    if (next && ms >= next.at) {
      milestoneIdxRef.current += 1
      setMilestone(next.text)
      vibrate(next.buzz)
      sfx.milestone()
    }

    // Challenge moment: the instant you pass your mate's time
    if (challenge && !beatCrossedRef.current && ms >= challenge.beat) {
      beatCrossedRef.current = true
      setMilestone(`that's ${challenge.from} beaten. don't stop now`)
      vibrate([40, 60, 40])
      sfx.win()
    }

    // Fake notifications after 2 minutes
    if (ms >= 120_000 && ms >= nextNotifRef.current) {
      nextNotifRef.current = ms + 12_000 + Math.random() * 10_000
      const n = drawNotification()
      const id = ++notifIdRef.current
      setNotifs(list => [...list.slice(-2), { ...n, id, top: 8 + Math.random() * 30 }])
      setTimeout(() => setNotifs(list => list.filter(x => x.id !== id)), 6000)
      sfx.notif()
    }

    // Slip check: every frame-ish, make sure each held finger is still
    // physically on a button — catches sliding off, and the button
    // drifting out from under a stationary finger
    if (ms - lastSlipCheckRef.current > 80) {
      lastSlipCheckRef.current = ms
      setMusicIntensity(Math.min(1, ms / 600_000))
      for (const pid of Object.values(heldRef.current)) {
        if (pid == null) continue
        const pos = pointerPosRef.current[pid]
        if (!pos) continue
        const el = document.elementFromPoint(pos.x, pos.y)
        if (!el || !el.closest('.big-button')) {
          endRunRef.current('slip')
          return
        }
      }
    }

    // Phase-2 mischief after 5 minutes: the button starts playing games back
    if (ms >= 300_000 && ms >= nextGagRef.current) {
      nextGagRef.current = ms + 15_000 + Math.random() * 10_000
      const type = GAG_TYPES[Math.floor(Math.random() * GAG_TYPES.length)]
      const decoys = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({
        x: 5 + Math.random() * 60,
        y: 8 + Math.random() * 55,
      }))
      setGag({
        type,
        start: ms,
        until: ms + (type === 'decoy' ? 7_000 : type === 'gravity' ? 5_000 : 4_500),
        decoys,
      })
      sfx.gag()
    }
    setGag(g => (g && ms > g.until ? null : g))

    rafRef.current = requestAnimationFrame(tick)
  }, [challenge])

  const startTimer = useCallback(() => {
    holdingRef.current = true
    startRef.current = performance.now()
    milestoneIdxRef.current = 0
    nextNotifRef.current = 120_000
    nextGagRef.current = 300_000
    beatCrossedRef.current = false
    setElapsed(0)
    setMilestone(null)
    setGag(null)
    setHolding(true)
    vibrate(15)
    sfx.press()
    startMusic()
    try { channelRef.current?.track({ holding: true }) } catch { /* ignore */ }
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const onBtnDown = useCallback((id, e) => {
    if (e.button != null && e.button !== 0) return
    if (heldRef.current[id] != null) return // already held by another finger
    // Undo implicit pointer capture (touch pins the pointer to the button,
    // which would let a finger wander off-screen without us noticing)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* fine */ }
    heldRef.current[id] = e.pointerId
    pointerPosRef.current[e.pointerId] = { x: e.clientX, y: e.clientY }
    if (holdingRef.current) return
    const need = modeRef.current === 'duo' ? ['a', 'b'] : ['a']
    if (need.every(k => heldRef.current[k] != null)) startTimer()
  }, [startTimer])

  // Only the pointer actually doing the holding can end the run — a mouse
  // cursor drifting across the button must not count
  const onBtnUp = useCallback((id, e) => {
    if (heldRef.current[id] == null || heldRef.current[id] !== e.pointerId) return
    delete heldRef.current[id]
    if (holdingRef.current) endRunRef.current('release')
  }, [])

  // The holding pointer left the button while still down: a slip, not a release
  const onBtnLeave = useCallback((id, e) => {
    if (heldRef.current[id] == null || heldRef.current[id] !== e.pointerId) return
    delete heldRef.current[id]
    if (holdingRef.current) endRunRef.current('slip')
  }, [])

  // Track where every active pointer is, for the slip check
  useEffect(() => {
    const onMove = (e) => {
      pointerPosRef.current[e.pointerId] = { x: e.clientX, y: e.clientY }
    }
    const onGone = (e) => { delete pointerPosRef.current[e.pointerId] }
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onGone, true)
    document.addEventListener('pointercancel', onGone, true)
    return () => {
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerup', onGone, true)
      document.removeEventListener('pointercancel', onGone, true)
    }
  }, [])

  // Touching anywhere that isn't a game button ends the run. Yes, that
  // includes the fake notifications and the decoy. Especially those.
  useEffect(() => {
    const onStray = (e) => {
      if (!holdingRef.current) return
      if (e.target && e.target.closest && e.target.closest('.big-button')) return
      // Note what they fell for — the Hall of Deaths wants specifics
      const notif = e.target?.closest?.('.fake-notif')
      if (notif) {
        const from = notif.getAttribute('data-from') || 'a notification'
        strayDetailRef.current = `tapped a fake notification from ${from}`
      } else if (e.target?.closest?.('.decoy-button')) {
        strayDetailRef.current = 'fell for a decoy button'
      } else {
        strayDetailRef.current = 'touched something that was not the button'
      }
      endRunRef.current('stray')
    }
    document.addEventListener('pointerdown', onStray, true)
    return () => document.removeEventListener('pointerdown', onStray, true)
  }, [])

  // Losing focus ends the run — no pausing
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') endRunRef.current('focus')
    }
    const onBlur = () => endRunRef.current('focus')
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // Block context menu / long-press menus during a hold
  useEffect(() => {
    const stop = (e) => { if (holdingRef.current) e.preventDefault() }
    document.addEventListener('contextmenu', stop)
    return () => document.removeEventListener('contextmenu', stop)
  }, [])

  if (screen === 'results' && lastRun) {
    return (
      <Results
        run={lastRun}
        best={best}
        streak={streak}
        onAgain={() => { setLastRun(null); setScreen('game') }}
        onBoard={() => setScreen('board')}
      />
    )
  }

  if (screen === 'board') {
    return <Leaderboard onBack={() => setScreen(lastRun ? 'results' : 'game')} />
  }

  // Escalating mischief, driven by elapsed time: slow drift from 10s,
  // slow shrink from 20s, both creeping up the longer you hold.
  // At 7 minutes the button shrinks another 10% and drifts 10% faster
  // (phase ramps keep the motion continuous — no teleporting).
  const s = elapsed / 1000
  const over7 = Math.max(0, s - 420)
  const driftAmp = s > 10 ? Math.min((s - 10) * 0.9, 80) : 0
  const driftX = driftAmp * Math.sin(s * 0.5 + over7 * 0.05)
  const driftY = driftAmp * 0.7 * Math.sin(s * 0.34 + over7 * 0.034 + 2)
  const lateShrink = over7 > 0 ? Math.max(0.9, 1 - over7 * 0.01) : 1
  const scale = (s > 20 ? Math.max(1 - (s - 20) * 0.0016, 0.7) : 1) * lateShrink

  // Gravity gag: the button sinks toward the floor and climbs back over 5s.
  // Follow it down or slip. Uses the same slip detection as everything else.
  let gravY = 0
  if (gag?.type === 'gravity') {
    const p = Math.min(Math.max((elapsed - gag.start) / 5000, 0), 1)
    gravY = Math.min(240, window.innerHeight * 0.25) * Math.sin(Math.PI * p)
  }

  const gagStyle = {}
  let label = holding ? 'HOLD' : 'HOLD ME'
  if (gag?.type === 'ghost') gagStyle.opacity = 0.07
  if (gag?.type === 'disco') gagStyle.filter = 'hue-rotate(140deg) saturate(1.5)'
  if (gag?.type === 'liar') label = 'RELEASE NOW'

  // The face reflects how the run is going
  let mood = 'happy'
  if (holding) {
    if (gag?.type === 'liar') mood = 'angry'
    else if (gag?.type === 'gravity') mood = 'panic'
    else if (gag?.type === 'decoy') mood = 'mischief'
    else if (s > 420) mood = 'unhinged'
    else if (s > 300) mood = 'mischief'
    else if (s > 120) mood = 'worried'
    else if (s > 30) mood = 'focused'
  }

  const duo = mode === 'duo'
  const buttons = duo ? ['a', 'b'] : ['a']

  return (
    <div className={`game${duo ? ' duo' : ''}${holding ? ' live' : ''}`}>
      <div className="backdrop" aria-hidden="true">
        <div className="bd-cine" style={cineBg ? { backgroundImage: `url(${cineBg})`, opacity: 1 } : undefined} />
        <div className="bd-glow" />
        <div className="bd-orb o1" /><div className="bd-orb o2" /><div className="bd-orb o3" />
        <div className="bd-orb o4" /><div className="bd-orb o5" />
        <div className="bd-grid" />
      </div>
      {holding ? (
        <>
          <div className="timer" aria-live="off">{fmtTime(elapsed)}</div>
          {holders > 1 && <p className="holders-line">{holders - 1} other {holders === 2 ? 'thumb' : 'thumbs'} occupied right now</p>}
        </>
      ) : (
        <header className="intro">
          <h1>Hold The<br />Button</h1>
          {challenge ? (
            <p className="challenge-line">
              <strong>{challenge.from}</strong> held for <strong>{fmtTime(challenge.beat)}</strong>. Off you go.
            </p>
          ) : (
            <p>Press and hold for as long as you can. Let go and your time goes on the board.</p>
          )}
          <p className="warn">Touch anything but the button and you&apos;re done. Leaving this tab ends your run. No pausing. Them&apos;s the rules.</p>
          <p className="pb">
            {best > 0 && <>Your best: <strong>{fmtTime(best)}</strong></>}
            {best > 0 && streak > 1 && <> &nbsp;·&nbsp; </>}
            {streak > 1 && <>🔥 {streak}-day streak</>}
          </p>
          {holders > 0 && <p className="holders-line">{holders} {holders === 1 ? 'person is' : 'people are'} holding right now</p>}
          {king?.prev ? (
            <p className="king-line">👑 King of the Hour: <strong>{king.prev.name}</strong> — {fmtTime(king.prev.ms)}</p>
          ) : king?.current ? (
            <p className="king-line">👑 <strong>{king.current.name}</strong> leads this hour with {fmtTime(king.current.ms)}. Have that off them.</p>
          ) : null}
        </header>
      )}

      {milestone && <div className="milestone" key={milestone}>{milestone}</div>}

      {!holding && (
        <nav className="bottom-row">
          <button className="link-btn" onClick={() => setMode(duo ? 'solo' : 'duo')}>
            {duo ? 'Back to one thumb' : 'Two-thumb mode'}
          </button>
          <button className="link-btn" onClick={() => setScreen('board')}>Leaderboard</button>
          <button className="link-btn" onClick={() => {
            const m = toggleMuted()
            setMuted(m)
            if (m) stopMusic()
            else sfx.win() // audible proof the speaker works
          }}>
            {muted ? '🔇 Sound off' : '🔊 Sound on'}
          </button>
        </nav>
      )}
      {duo && !holding && <p className="duo-hint">Hold both. Either lets go, you&apos;re done.</p>}

      <div className="button-zone">
        {buttons.map(id => (
          <button
            key={id}
            className={`big-button${holding ? ' held' : ''}`}
            style={{ transform: `translate(${id === 'b' ? -driftX : driftX}px, ${driftY + gravY}px) scale(${scale})`, ...gagStyle }}
            onPointerDown={e => onBtnDown(id, e)}
            onPointerUp={e => onBtnUp(id, e)}
            onPointerLeave={e => onBtnLeave(id, e)}
            onPointerCancel={e => onBtnUp(id, e)}
          >
            <Face mood={mood} />
            {duo && !holding ? (id === 'a' ? 'LEFT' : 'RIGHT') : label}
          </button>
        ))}
      </div>

      {gag?.type === 'decoy' && gag.decoys.map((d, i) => (
        <button
          key={i}
          className="decoy-button"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
        >
          HOLD ME
        </button>
      ))}

      {notifs.map(n => (
        <div key={n.id} className="fake-notif" data-from={n.title} style={{ top: `${n.top}%` }}>
          <span className="fn-icon">{n.icon}</span>
          <span><strong>{n.title}</strong><br />{n.body}</span>
        </div>
      ))}

      <footer className="sponsor-strip">
        <a href="https://rifkinandlivesey.co.uk" target="_blank" rel="noopener">
          Free to play, brought to you by <strong>Rifkin&nbsp;&amp;&nbsp;Livesey</strong> — Commercial Photography, Lancashire
        </a>
      </footer>
    </div>
  )
}

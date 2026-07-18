import { useEffect, useRef, useState, useCallback } from 'react'
import Results from './Results.jsx'
import Leaderboard from './Leaderboard.jsx'
import { fmtTime, vibrate } from './format.js'
import { drawNotification } from './notifications.js'
import { supabase } from './supabase.js'

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
  { at: 720_000, text: "we've run out of nice things to say", buzz: 20 },
  { at: 900_000, text: 'genuinely impressed. slightly worried', buzz: 20 },
  { at: 1_200_000, text: 'your ancestors crossed oceans for this', buzz: 20 },
  { at: 1_800_000, text: 'put it down and go outside', buzz: [40, 60, 40] },
]

const GAG_TYPES = ['ghost', 'disco', 'liar', 'decoy']

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
  modeRef.current = mode

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

    if (ms < 50 && reason === 'release') {
      // Accidental tap: no run, no fuss
      setElapsed(0)
      return
    }
    const final = Math.floor(ms)
    setLastRun({ ms: final, reason, mode: modeRef.current, challenge })
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
    }

    // Challenge moment: the instant you pass your mate's time
    if (challenge && !beatCrossedRef.current && ms >= challenge.beat) {
      beatCrossedRef.current = true
      setMilestone(`that's ${challenge.from} beaten. don't stop now`)
      vibrate([40, 60, 40])
    }

    // Fake notifications after 2 minutes
    if (ms >= 120_000 && ms >= nextNotifRef.current) {
      nextNotifRef.current = ms + 12_000 + Math.random() * 10_000
      const n = drawNotification()
      const id = ++notifIdRef.current
      setNotifs(list => [...list.slice(-2), { ...n, id, top: 8 + Math.random() * 30 }])
      setTimeout(() => setNotifs(list => list.filter(x => x.id !== id)), 6000)
    }

    // Phase-2 mischief after 5 minutes: the button starts playing games back
    if (ms >= 300_000 && ms >= nextGagRef.current) {
      nextGagRef.current = ms + 15_000 + Math.random() * 10_000
      const type = GAG_TYPES[Math.floor(Math.random() * GAG_TYPES.length)]
      setGag({
        type,
        until: ms + (type === 'decoy' ? 7_000 : 4_500),
        x: 8 + Math.random() * 55,
        y: 12 + Math.random() * 45,
      })
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
    try { channelRef.current?.track({ holding: true }) } catch { /* ignore */ }
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const onBtnDown = useCallback((id, e) => {
    if (e.button != null && e.button !== 0) return
    heldRef.current[id] = true
    if (holdingRef.current) return
    const need = modeRef.current === 'duo' ? ['a', 'b'] : ['a']
    if (need.every(k => heldRef.current[k])) startTimer()
  }, [startTimer])

  const onBtnUp = useCallback((id) => {
    if (!heldRef.current[id]) return
    heldRef.current[id] = false
    if (holdingRef.current) endRunRef.current('release')
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
  // slow shrink from 20s, both creeping up the longer you hold
  const s = elapsed / 1000
  const driftAmp = s > 10 ? Math.min((s - 10) * 0.9, 80) : 0
  const driftX = driftAmp * Math.sin(s * 0.5)
  const driftY = driftAmp * 0.7 * Math.sin(s * 0.34 + 2)
  const scale = s > 20 ? Math.max(1 - (s - 20) * 0.0016, 0.7) : 1

  const gagStyle = {}
  let label = holding ? 'HOLD' : 'HOLD ME'
  if (gag?.type === 'ghost') gagStyle.opacity = 0.07
  if (gag?.type === 'disco') gagStyle.filter = 'hue-rotate(140deg) saturate(1.5)'
  if (gag?.type === 'liar') label = 'RELEASE NOW'

  const duo = mode === 'duo'
  const buttons = duo ? ['a', 'b'] : ['a']

  return (
    <div className={`game${duo ? ' duo' : ''}`}>
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
          <p className="warn">Leaving this tab ends your run. No pausing. Them&apos;s the rules.</p>
          <p className="pb">
            {best > 0 && <>Your best: <strong>{fmtTime(best)}</strong></>}
            {best > 0 && streak > 1 && <> &nbsp;·&nbsp; </>}
            {streak > 1 && <>🔥 {streak}-day streak</>}
          </p>
          {holders > 0 && <p className="holders-line">{holders} {holders === 1 ? 'person is' : 'people are'} holding right now</p>}
        </header>
      )}

      {milestone && <div className="milestone" key={milestone}>{milestone}</div>}

      <div className="button-zone">
        {buttons.map(id => (
          <button
            key={id}
            className={`big-button${holding ? ' held' : ''}`}
            style={{ transform: `translate(${id === 'b' ? -driftX : driftX}px, ${driftY}px) scale(${scale})`, ...gagStyle }}
            onPointerDown={e => onBtnDown(id, e)}
            onPointerUp={() => onBtnUp(id)}
            onPointerLeave={() => onBtnUp(id)}
            onPointerCancel={() => onBtnUp(id)}
          >
            {duo && !holding ? (id === 'a' ? 'LEFT' : 'RIGHT') : label}
          </button>
        ))}
      </div>

      {gag?.type === 'decoy' && (
        <button
          className="decoy-button"
          style={{ left: `${gag.x}%`, top: `${gag.y}%` }}
          onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
        >
          HOLD ME
        </button>
      )}

      {!holding && (
        <nav className="bottom-row">
          <button className="link-btn" onClick={() => setMode(duo ? 'solo' : 'duo')}>
            {duo ? 'Back to one thumb' : 'Two-thumb mode'}
          </button>
          <button className="link-btn" onClick={() => setScreen('board')}>Leaderboard</button>
        </nav>
      )}

      {duo && !holding && <p className="duo-hint">Hold both. Either lets go, you&apos;re done.</p>}

      {notifs.map(n => (
        <div key={n.id} className="fake-notif" style={{ top: `${n.top}%` }}
          onPointerDown={(e) => e.stopPropagation()}>
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

import { useEffect, useRef, useState, useCallback } from 'react'
import Results from './Results.jsx'
import Leaderboard from './Leaderboard.jsx'
import { fmtTime, vibrate } from './format.js'

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
  { at: 180_000, text: 'three minutes. respectable. ish', buzz: [20, 40, 20] },
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

const FAKE_NOTIFS = [
  { icon: '📞', title: 'Mum', body: 'Missed call (2)' },
  { icon: '🔋', title: 'Battery', body: '3% remaining. Probably.' },
  { icon: '💬', title: 'Dave', body: 'you still holding that button lol' },
  { icon: '📰', title: 'Breaking', body: 'Local person still holding button' },
  { icon: '🫖', title: 'Kettle', body: 'Your brew has gone cold' },
  { icon: '❤️', title: 'New match', body: "It's the button. It likes you too." },
  { icon: '📦', title: 'Delivery', body: 'Your parcel is 2 stops away' },
  { icon: '🏆', title: 'Achievement', body: 'Tap to claim your prize (do not)' },
  { icon: '🐕', title: 'Reminder', body: 'The dog wants out' },
]

export default function App() {
  const [screen, setScreen] = useState('game') // game | results | board
  const [holding, setHolding] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [milestone, setMilestone] = useState(null)
  const [notifs, setNotifs] = useState([])
  const [lastRun, setLastRun] = useState(null) // { ms, reason }
  const [best, setBest] = useState(() => Number(localStorage.getItem('htb_best')) || 0)

  const startRef = useRef(0)
  const rafRef = useRef(0)
  const holdingRef = useRef(false)
  const pointerIdRef = useRef(null)
  const milestoneIdxRef = useRef(0)
  const nextNotifRef = useRef(0)
  const notifIdRef = useRef(0)
  const buttonRef = useRef(null)

  const endRun = useCallback((reason) => {
    if (!holdingRef.current) return
    const ms = performance.now() - startRef.current
    holdingRef.current = false
    pointerIdRef.current = null
    cancelAnimationFrame(rafRef.current)
    setHolding(false)
    setNotifs([])
    setMilestone(null)

    if (ms < 50 && reason === 'release') {
      // Accidental tap: no run, no fuss
      setElapsed(0)
      return
    }
    const final = Math.floor(ms)
    setLastRun({ ms: final, reason })
    if (final > best) {
      setBest(final)
      localStorage.setItem('htb_best', String(final))
    }
    vibrate([30, 50, 30])
    setScreen('results')
  }, [best])

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

    // Fake notifications after 2 minutes
    if (ms >= 120_000 && ms >= nextNotifRef.current) {
      nextNotifRef.current = ms + 12_000 + Math.random() * 10_000
      const n = FAKE_NOTIFS[Math.floor(Math.random() * FAKE_NOTIFS.length)]
      const id = ++notifIdRef.current
      setNotifs(list => [...list.slice(-2), { ...n, id, top: 8 + Math.random() * 30 }])
      setTimeout(() => setNotifs(list => list.filter(x => x.id !== id)), 6000)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const startHold = useCallback((e) => {
    if (holdingRef.current) return
    if (e.button != null && e.button !== 0) return
    pointerIdRef.current = e.pointerId
    holdingRef.current = true
    startRef.current = performance.now()
    milestoneIdxRef.current = 0
    nextNotifRef.current = 120_000
    setElapsed(0)
    setMilestone(null)
    setHolding(true)
    vibrate(15)
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const release = useCallback((e) => {
    if (!holdingRef.current) return
    if (e.pointerId != null && pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return
    endRunRef.current('release')
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

  return (
    <div className="game">
      {holding ? (
        <div className="timer" aria-live="off">{fmtTime(elapsed)}</div>
      ) : (
        <header className="intro">
          <h1>Hold The<br />Button</h1>
          <p>Press and hold for as long as you can. Let go and your time goes on the board.</p>
          <p className="warn">Leaving this tab ends your run. No pausing. Them&apos;s the rules.</p>
          {best > 0 && <p className="pb">Your best: <strong>{fmtTime(best)}</strong></p>}
        </header>
      )}

      {milestone && <div className="milestone" key={milestone}>{milestone}</div>}

      <div className="button-zone">
        <button
          ref={buttonRef}
          className={`big-button${holding ? ' held' : ''}`}
          style={{ transform: `translate(${driftX}px, ${driftY}px) scale(${scale})` }}
          onPointerDown={startHold}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
        >
          {holding ? 'HOLD' : 'HOLD ME'}
        </button>
      </div>

      {!holding && (
        <nav className="bottom-row">
          <button className="link-btn" onClick={() => setScreen('board')}>Leaderboard</button>
        </nav>
      )}

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

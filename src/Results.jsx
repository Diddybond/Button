import { useEffect, useState } from 'react'
import { fmtTime, guessCountry, vibrate } from './format.js'
import { fetchRank, submitScore } from './supabase.js'

const GAME_URL = typeof window !== 'undefined' ? window.location.origin : ''

export default function Results({ run, best, onAgain, onBoard }) {
  const isPB = run.ms >= best
  const [rank, setRank] = useState(null)
  const [name, setName] = useState(() => localStorage.getItem('htb_name') || '')
  const [posted, setPosted] = useState(null) // { rank }
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    let live = true
    fetchRank(run.ms).then(r => { if (live) setRank(r) }).catch(() => {})
    return () => { live = false }
  }, [run.ms])

  const shownRank = posted?.rank ?? rank

  async function post() {
    const n = name.trim()
    if (n.length < 3 || n.length > 12) {
      setError('Name needs to be 3–12 characters.')
      return
    }
    setPosting(true)
    setError(null)
    try {
      const res = await submitScore(n, run.ms, guessCountry())
      localStorage.setItem('htb_name', n)
      setPosted(res)
      vibrate(30)
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('NAME_PROFANITY')) setError("That name's not going on the board. Try another.")
      else if (msg.includes('RATE_LIMITED')) setError('Steady on. Too many posts — try again in a few minutes.')
      else if (msg.includes('NAME_CHARS')) setError('Letters, numbers, spaces and - _ . only.')
      else if (msg.includes('TIME_TOO_SHORT')) setError('Runs under a second don’t make the board.')
      else setError('Couldn’t post that. Give it another go.')
    } finally {
      setPosting(false)
    }
  }

  async function share() {
    const rankBit = shownRank ? ` Rank #${shownRank} in the world.` : ''
    const text = `I held the button for ${fmtTime(run.ms)} \u{1F624}${rankBit} Think you can beat me? ${GAME_URL} — free to play, sponsored by rifkinandlivesey.co.uk`
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setShared(true)
        setTimeout(() => setShared(false), 2500)
      }
    } catch {
      /* user cancelled the share sheet — fine */
    }
  }

  return (
    <div className="results">
      <p className="verdict">
        {run.reason === 'focus' ? 'You looked away. The button noticed.' : 'You let go.'}
      </p>
      <div className="final-time">{fmtTime(run.ms)}</div>
      <p className="sub-line">
        {isPB ? 'New personal best.' : <>Personal best: <strong>{fmtTime(best)}</strong></>}
        {shownRank != null && <> &nbsp;·&nbsp; Rank <strong>#{shownRank}</strong> in the world</>}
      </p>

      <a className="sponsor-card" href="https://rifkinandlivesey.co.uk" target="_blank" rel="noopener">
        <span className="sp-label">Sponsored by</span>
        <span className="sp-name">Rifkin &amp; Livesey</span>
        <span className="sp-tag">Commercial, Industrial &amp; Product Photography</span>
        <span className="sp-url">rifkinandlivesey.co.uk</span>
      </a>

      {!posted ? (
        <div className="post-row">
          <input
            value={name}
            onChange={e => setName(e.target.value.slice(0, 12))}
            placeholder="Your name (3–12)"
            maxLength={12}
            autoComplete="off"
            enterKeyHint="go"
            onKeyDown={e => { if (e.key === 'Enter') post() }}
          />
          <button className="accent-btn" onClick={post} disabled={posting}>
            {posting ? 'Posting…' : 'Post score'}
          </button>
        </div>
      ) : (
        <p className="posted-note">On the board as <strong>{name.trim()}</strong>, rank #{posted.rank}.</p>
      )}
      {error && <p className="error">{error}</p>}

      <button className="accent-btn share-btn" onClick={share}>
        {shared ? 'Copied. Go brag.' : 'Share your time'}
      </button>

      <div className="results-nav">
        <button className="link-btn" onClick={onAgain}>Go again</button>
        <button className="link-btn" onClick={onBoard}>Leaderboard</button>
      </div>
    </div>
  )
}

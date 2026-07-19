import { useEffect, useState } from 'react'
import { fmtTime, guessCountry, vibrate } from './format.js'
import { fetchRank, submitScore } from './supabase.js'
import { timeToTitle } from './titles.js'
import { makeShareCard } from './sharecard.js'
import { sfx } from './sound.js'

const GAME_URL = typeof window !== 'undefined' ? window.location.origin : ''

export default function Results({ run, best, streak, onAgain, onBoard }) {
  const isPB = run.mode === 'solo' && run.ms >= best
  const title = timeToTitle(run.ms)
  const [rank, setRank] = useState(null)
  const [name, setName] = useState(() => localStorage.getItem('htb_name') || '')
  const [linkedin, setLinkedin] = useState(() => localStorage.getItem('htb_linkedin') || '')
  const [facebook, setFacebook] = useState(() => localStorage.getItem('htb_facebook') || '')
  const [posted, setPosted] = useState(null) // { rank }
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const [shared, setShared] = useState(false)
  const [cardBusy, setCardBusy] = useState(false)

  useEffect(() => {
    let live = true
    fetchRank(run.ms, run.mode).then(r => { if (live) setRank(r) }).catch(() => {})
    return () => { live = false }
  }, [run.ms, run.mode])

  const shownRank = posted?.rank ?? rank
  const beatChallenge = run.challenge && run.ms >= run.challenge.beat

  async function post() {
    const n = name.trim()
    if (n.length < 3 || n.length > 12) {
      setError('Name needs to be 3–12 characters.')
      return
    }
    let li = linkedin.trim()
    if (li && /^(www\.)?linkedin\.com\//.test(li)) li = 'https://' + li
    if (li && !/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%.]{3,100}\/?$/.test(li)) {
      setError('LinkedIn link should look like linkedin.com/in/yourname — or leave it blank.')
      return
    }
    let fb = facebook.trim()
    if (fb && /^((www|m)\.)?(facebook|fb)\.com\//.test(fb)) fb = 'https://' + fb
    if (fb && !/^https:\/\/((www|m)\.)?(facebook|fb)\.com\/([A-Za-z0-9.\-]{3,100}\/?|profile\.php\?id=[0-9]{3,30})$/.test(fb)) {
      setError('Facebook link should look like facebook.com/yourname — or leave it blank.')
      return
    }
    setPosting(true)
    setError(null)
    try {
      const res = await submitScore(n, run.ms, guessCountry(), li || null, fb || null, run.mode, run.reason, run.detail)
      localStorage.setItem('htb_name', n)
      if (li) localStorage.setItem('htb_linkedin', li)
      if (fb) localStorage.setItem('htb_facebook', fb)
      setPosted(res)
      vibrate(30)
      sfx.win()
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('NAME_PROFANITY')) setError("That name's not going on the board. Try another.")
      else if (msg.includes('RATE_LIMITED')) setError('Steady on. Too many posts — try again in a few minutes.')
      else if (msg.includes('NAME_CHARS')) setError('Letters, numbers, spaces and - _ . only.')
      else if (msg.includes('LINKEDIN_INVALID')) setError('That LinkedIn link doesn’t look right — linkedin.com/in/yourname or blank.')
      else if (msg.includes('FACEBOOK_INVALID')) setError('That Facebook link doesn’t look right — facebook.com/yourname or blank.')
      else if (msg.includes('TIME_TOO_SHORT')) setError('Runs under a second don’t make the board.')
      else setError('Couldn’t post that. Give it another go.')
    } finally {
      setPosting(false)
    }
  }

  function challengeUrl() {
    const from = encodeURIComponent(name.trim() || localStorage.getItem('htb_name') || 'A mate')
    return `${GAME_URL}/?beat=${run.ms}&from=${from}`
  }

  async function share() {
    const rankBit = shownRank ? ` Rank #${shownRank} in the world.` : ''
    const duoBit = run.mode === 'duo' ? ' (two-thumb mode)' : ''
    const text = `I held the button for ${fmtTime(run.ms)}${duoBit} \u{1F624} "${title}".${rankBit} Think you can beat me? ${challengeUrl()} — free to play, sponsored by rifkinandlivesey.co.uk`
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

  async function shareCard() {
    setCardBusy(true)
    try {
      const blob = await makeShareCard({ ms: run.ms, rank: shownRank, title, reason: run.reason })
      const file = new File([blob], `hold-the-button-${fmtTime(run.ms).replace(/[:.]/g, '-')}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `Think you can beat me? ${challengeUrl()}` })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      }
    } catch {
      /* cancelled or unsupported — no drama */
    } finally {
      setCardBusy(false)
    }
  }

  return (
    <div className="results">
      <p className="verdict">
        {run.reason === 'focus' ? 'You looked away. The button noticed.'
          : run.reason === 'stray' ? 'You touched something that wasn’t the button. Fatal.'
          : run.reason === 'slip' ? 'Your finger wandered off the button. It noticed.'
          : 'You let go.'}
      </p>
      <div className="final-time">{fmtTime(run.ms)}</div>
      <p className="title-line">“{title}”{run.mode === 'duo' && ' · two-thumb mode'}</p>
      <p className="sub-line">
        {isPB ? 'New personal best.' : run.mode === 'solo' ? <>Personal best: <strong>{fmtTime(best)}</strong></> : null}
        {shownRank != null && <> &nbsp;·&nbsp; Rank <strong>#{shownRank}</strong> {run.mode === 'duo' ? 'in two-thumb' : 'in the world'}</>}
        {streak > 1 && <> &nbsp;·&nbsp; 🔥 {streak}-day streak</>}
      </p>
      {run.challenge && (
        <p className="challenge-result">
          {beatChallenge
            ? <>That&apos;s <strong>{run.challenge.from}</strong> beaten. Send it back.</>
            : <><strong>{run.challenge.from}</strong> survives — you were {fmtTime(run.challenge.beat - run.ms)} short.</>}
        </p>
      )}

      <a className="sponsor-card" href="https://rifkinandlivesey.co.uk" target="_blank" rel="noopener">
        <span className="sp-label">Sponsored by</span>
        <span className="sp-name">Rifkin &amp; Livesey</span>
        <span className="sp-tag">Commercial, Industrial &amp; Product Photography</span>
        <span className="sp-url">rifkinandlivesey.co.uk</span>
      </a>

      {!posted ? (
        <div className="post-block">
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
          <input
            className="linkedin-input"
            value={linkedin}
            onChange={e => setLinkedin(e.target.value.slice(0, 120))}
            placeholder="LinkedIn profile link (optional, shown on the board)"
            autoComplete="off"
            inputMode="url"
            onKeyDown={e => { if (e.key === 'Enter') post() }}
          />
          <input
            className="linkedin-input"
            value={facebook}
            onChange={e => setFacebook(e.target.value.slice(0, 160))}
            placeholder="Facebook profile link (optional, shown on the board)"
            autoComplete="off"
            inputMode="url"
            onKeyDown={e => { if (e.key === 'Enter') post() }}
          />
        </div>
      ) : (
        <p className="posted-note">On the board as <strong>{name.trim()}</strong>, rank #{posted.rank}.</p>
      )}
      {error && <p className="error">{error}</p>}

      <button className="accent-btn share-btn" onClick={share}>
        {shared ? 'Copied. Go brag.' : 'Challenge a mate'}
      </button>
      <button className="ghost-btn" onClick={shareCard} disabled={cardBusy}>
        {cardBusy ? 'Making your card…' : 'Get your score card'}
      </button>

      <div className="results-nav">
        <button className="link-btn" onClick={onAgain}>Go again</button>
        <button className="link-btn" onClick={onBoard}>Leaderboard</button>
      </div>
    </div>
  )
}

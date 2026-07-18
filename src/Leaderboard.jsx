import { useEffect, useState } from 'react'
import { fmtTime, countryFlag, guessCountry } from './format.js'
import { fetchBoard, fetchDeaths } from './supabase.js'

const PERIODS = [
  { key: 'day', label: 'Today', hours: 24 },
  { key: 'week', label: 'This week', hours: 168 },
  { key: 'all', label: 'All-time' },
  { key: 'deaths', label: '💀 Deaths' },
]

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const CAUSE_FALLBACK = {
  release: 'simply let go',
  slip: 'slid off the button',
  focus: 'looked away',
  stray: 'touched something that was not the button',
}

export default function Leaderboard({ onBack }) {
  const myCountry = guessCountry()
  const [period, setPeriod] = useState('all')
  const [mode, setMode] = useState('solo')
  const [scope, setScope] = useState('world') // world | local
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)
  const deaths = period === 'deaths'

  useEffect(() => {
    setRows(null)
    setError(false)
    if (deaths) {
      fetchDeaths().then(setRows).catch(() => setError(true))
      return
    }
    const p = PERIODS.find(x => x.key === period)
    fetchBoard({
      mode,
      hours: p?.hours,
      country: scope === 'local' && myCountry ? myCountry : undefined,
    }).then(setRows).catch(() => setError(true))
  }, [period, mode, scope, myCountry, deaths])

  return (
    <div className="board">
      <div className="board-head">
        <button className="link-btn" onClick={onBack}>&larr; Back</button>
        <h2>{deaths ? 'Hall of Deaths' : 'Top 100'}</h2>
      </div>

      <div className="tab-row">
        {PERIODS.map(p => (
          <button key={p.key} className={`tab${period === p.key ? ' on' : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      {!deaths && (
        <div className="tab-row">
          <button className={`tab${mode === 'solo' ? ' on' : ''}`} onClick={() => setMode('solo')}>One thumb</button>
          <button className={`tab${mode === 'duo' ? ' on' : ''}`} onClick={() => setMode('duo')}>Two thumbs</button>
          {myCountry && (
            <>
              <button className={`tab${scope === 'world' ? ' on' : ''}`} onClick={() => setScope('world')}>World</button>
              <button className={`tab${scope === 'local' ? ' on' : ''}`} onClick={() => setScope('local')}>
                {countryFlag(myCountry) || myCountry}
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="error">Leaderboard&apos;s having a moment. Try again shortly.</p>}
      {!rows && !error && <p className="loading">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="loading">{deaths ? 'No deaths yet. Statistically unlikely to last.' : 'Nobody yet. The board is yours for the taking.'}</p>
      )}

      {rows && rows.length > 0 && deaths && (
        <ul className="death-list">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="d-head">
                💀 <strong>{r.name}</strong> {countryFlag(r.country)} — {fmtTime(r.ms)}
                <span className="d-ago">{timeAgo(r.created_at)}</span>
              </span>
              <span className="d-detail">{r.cause_detail || CAUSE_FALLBACK[r.cause] || 'died of unknown causes'}</span>
            </li>
          ))}
        </ul>
      )}

      {rows && rows.length > 0 && !deaths && (
        <ol className="board-list">
          {rows.map((r, i) => (
            <li key={i} className={i < 3 ? 'podium' : ''}>
              <span className="rank">#{i + 1}</span>
              <span className="bname">
                {r.name} {countryFlag(r.country)}
                {r.linkedin && (
                  <a className="li-badge" href={r.linkedin} target="_blank" rel="noopener nofollow"
                    title={`${r.name} on LinkedIn`}>in</a>
                )}
              </span>
              <span className="btime">{fmtTime(r.ms)}</span>
            </li>
          ))}
        </ol>
      )}
      <footer className="sponsor-strip">
        <a href="https://rifkinandlivesey.co.uk" target="_blank" rel="noopener">
          Free to play, brought to you by <strong>Rifkin&nbsp;&amp;&nbsp;Livesey</strong> — Commercial Photography, Lancashire
        </a>
      </footer>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { fmtTime, countryFlag } from './format.js'
import { fetchTop100 } from './supabase.js'

export default function Leaderboard({ onBack }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTop100().then(setRows).catch(() => setError(true))
  }, [])

  return (
    <div className="board">
      <div className="board-head">
        <button className="link-btn" onClick={onBack}>&larr; Back</button>
        <h2>Top 100</h2>
      </div>
      {error && <p className="error">Leaderboard&apos;s having a moment. Try again shortly.</p>}
      {!rows && !error && <p className="loading">Loading…</p>}
      {rows && rows.length === 0 && <p className="loading">Nobody yet. The board is yours for the taking.</p>}
      {rows && rows.length > 0 && (
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

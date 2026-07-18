# Hold The Button

An endurance game: press and hold the big button for as long as you can.
Global leaderboard, personal bests, escalating mischief. Free to play,
sponsored by [Rifkin & Livesey](https://rifkinandlivesey.co.uk).

## Stack

- React + Vite (no router, no state library — one page, three screens)
- Supabase for the leaderboard (no auth; players enter a 3–12 char name)
- Deployed on Vercel

## Local development

```bash
npm install
npm run dev
```

Supabase URL and publishable (anon) key are baked in as defaults in
`src/supabase.js`; override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
if needed. Both are public client-side values by design.

## Backend

One table (`button_scores`) with RLS: public read, **no direct writes**.
Scores go through the `submit_button_score` RPC, which:

- validates names (3–12 chars, safe character set, profanity blocklist)
- rejects times under 1s or over 24h
- rate-limits to 6 submissions per IP per 10 minutes (via request headers)
- returns the new global rank

`get_button_rank(ms)` returns a rank for an unsubmitted time. The full SQL
lives in the Supabase project as migration `hold_the_button_leaderboard`
(already applied).

## Sponsor

Two placements only, no popups:

- fixed footer strip on the game and leaderboard screens
- branded card on the results screen, directly under the score, inside the
  natural screenshot area

Swap the text-only mark for a logo in `src/Results.jsx` (`.sponsor-card`)
when the file arrives.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://aavsizdzxxumxvrnuoom.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_W9yxemDdeyW4IVwQvr2v1A_vbRuIij-'

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// hours: limit to the last N hours (undefined = all-time)
// country: two-letter code to filter by (undefined = world)
export async function fetchBoard({ mode = 'solo', hours, country } = {}) {
  let q = supabase
    .from('button_scores')
    .select('name, ms, country, linkedin, created_at')
    .eq('mode', mode)
  if (hours) q = q.gte('created_at', new Date(Date.now() - hours * 3600_000).toISOString())
  if (country) q = q.eq('country', country)
  const { data, error } = await q.order('ms', { ascending: false }).limit(100)
  if (error) throw error
  return data
}

export async function fetchRank(ms, mode = 'solo') {
  const { data, error } = await supabase.rpc('get_button_rank', { p_ms: ms, p_mode: mode })
  if (error) throw error
  return data
}

export async function submitScore(name, ms, country, linkedin, mode = 'solo') {
  const { data, error } = await supabase.rpc('submit_button_score', {
    p_name: name,
    p_ms: ms,
    p_country: country || null,
    p_linkedin: linkedin || null,
    p_mode: mode,
  })
  if (error) throw error
  return data // { id, rank }
}

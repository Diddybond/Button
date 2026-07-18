import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://aavsizdzxxumxvrnuoom.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_W9yxemDdeyW4IVwQvr2v1A_vbRuIij-'

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function fetchTop100() {
  const { data, error } = await supabase
    .from('button_scores')
    .select('name, ms, country, created_at')
    .order('ms', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

export async function fetchRank(ms) {
  const { data, error } = await supabase.rpc('get_button_rank', { p_ms: ms })
  if (error) throw error
  return data
}

export async function submitScore(name, ms, country) {
  const { data, error } = await supabase.rpc('submit_button_score', {
    p_name: name,
    p_ms: ms,
    p_country: country || null,
  })
  if (error) throw error
  return data // { id, rank }
}

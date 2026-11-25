import { supabase } from './supabaseClient'

export async function getOverview() {
  const { data, error } = await supabase.rpc('admin_overview')
  if (error) throw new Error('Could not load the overview.')
  return data
}

export async function listAllTournaments() {
  const { data, error } = await supabase.rpc('admin_list_tournaments')
  if (error) throw new Error('Could not load tournaments.')
  return data || []
}

export async function setVerification(tournamentId, status) {
  const { error } = await supabase.rpc('admin_set_verification', { p_tournament: tournamentId, p_status: status })
  if (error) throw new Error('Could not change the status.')
}

/** The public announcement banner (anyone may read it). Returns null when none is showing. */
export async function getActiveAnnouncement() {
  const { data, error } = await supabase.from('site_announcement').select('message, active, updated_at').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return data
}

export async function setAnnouncement(message, active) {
  const { error } = await supabase.rpc('admin_set_announcement', { p_message: message, p_active: active })
  if (error) throw new Error('Could not save the announcement.')
}

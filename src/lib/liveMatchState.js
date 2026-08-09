import { db } from './db'
import { supabase } from './supabaseClient'

/**
 * This is what actually protects an in-progress game from being lost.
 *
 * - Local save (IndexedDB via matchCache): happens on every meaningful
 *   state change, debounced slightly. Works with zero internet.
 * - Cloud save (Supabase match_live_state): happens periodically while
 *   online, so the game is recoverable even if this browser's storage
 *   gets cleared, or a different device needs to pick it up.
 * - On load, MatchSimulate checks local first (fastest, most likely to
 *   be current), falling back to cloud if nothing local exists.
 *
 * Deleted once the match completes -- match_player_stats and the
 * matches row become the permanent record at that point.
 */

export async function saveLocalMatchState(matchId, tournamentId, state) {
  await db.matchCache.put({
    matchId,
    tournamentId,
    state,
    updatedAt: new Date().toISOString(),
  })
}

export async function getLocalMatchState(matchId) {
  const row = await db.matchCache.get(matchId)
  return row?.state ?? null
}

export async function pushCloudMatchState(matchId, state) {
  if (!navigator.onLine) return // don't even attempt -- local save already has it covered
  try {
    const { error } = await supabase
      .from('match_live_state')
      .upsert({ match_id: matchId, state, updated_at: new Date().toISOString() })
    if (error) console.warn('Could not sync live match state to cloud:', error.message)
  } catch (err) {
    console.warn('Could not sync live match state to cloud:', err.message)
  }
}

export async function getCloudMatchState(matchId) {
  try {
    const { data, error } = await supabase
      .from('match_live_state')
      .select('state')
      .eq('match_id', matchId)
      .maybeSingle()
    if (error) throw error
    return data?.state ?? null
  } catch (err) {
    console.warn('Could not fetch live match state from cloud:', err.message)
    return null
  }
}

/** Call once a match completes -- there's nothing left to resume. */
export async function clearMatchState(matchId) {
  await db.matchCache.delete(matchId)
  try {
    await supabase.from('match_live_state').delete().eq('match_id', matchId)
  } catch (err) {
    console.warn('Could not clear cloud live match state:', err.message)
  }
}

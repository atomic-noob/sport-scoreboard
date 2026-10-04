import { supabase } from './supabaseClient'

/**
 * Set-by-set score tracking for volleyball (and any future set-based
 * sport). matches.team_a_score / team_b_score hold SETS WON, kept in
 * sync with this table so the existing sport-agnostic bracket
 * advancement / forfeit / completion logic in matchesData.js works
 * unchanged -- this table is just the breakdown underneath that.
 */
export async function saveMatchSet(matchId, setNumber, teamAScore, teamBScore, winnerTeamId) {
  const { error } = await supabase
    .from('match_sets')
    .upsert(
      { match_id: matchId, set_number: setNumber, team_a_score: teamAScore, team_b_score: teamBScore, winner_team_id: winnerTeamId },
      { onConflict: 'match_id,set_number' }
    )
  if (error) throw error
}

/** Used when the scorer reopens a confirmed set: removes events from `fromSeq` on
 * so re-confirming the set doesn't leave stale rows behind. */
export async function deleteVolleyballEventsFrom(matchId, fromSeq) {
  const { error } = await supabase.from('volleyball_events').delete().eq('match_id', matchId).gte('seq', fromSeq)
  if (error) throw error
}

export async function getMatchSets(matchId) {
  const { data, error } = await supabase
    .from('match_sets')
    .select('*')
    .eq('match_id', matchId)
    .order('set_number', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    setNumber: row.set_number,
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    winnerTeamId: row.winner_team_id,
  }))
}

// ---------- Phase 2: per-player stats ----------

/**
 * The actions a scorer can record against a player.
 *  point: 'self'     -> the player's team gains the point
 *         'opponent' -> the OTHER team gains the point (an error)
 *         null       -> a stat only, the score does not change
 *  serverOnly: only the player currently serving can do this.
 */
export const VOLLEYBALL_ACTIONS = [
  { key: 'kill', label: 'Kill', point: 'self' },
  { key: 'ace', label: 'Ace', point: 'self', serverOnly: true },
  { key: 'block', label: 'Block', point: 'self' },
  { key: 'attack', label: 'Attack (no point)', point: null },
  { key: 'dig', label: 'Dig', point: null },
  { key: 'assist', label: 'Assist', point: null },
  { key: 'attack_error', label: 'Attack error', point: 'opponent' },
  { key: 'service_error', label: 'Service error', point: 'opponent', serverOnly: true },
]

/**
 * Saves a batch of events. Safe to call again with the same events (it
 * upserts on match_id + seq), so a retry after a failed save won't
 * create duplicates.
 * Each event: { seq, setNumber, teamId, playerId, action, pointTeamId }
 */
export async function saveVolleyballEvents(matchId, events) {
  if (!events || events.length === 0) return
  const rows = events.map((e) => ({
    match_id: matchId,
    seq: e.seq,
    set_number: e.setNumber,
    team_id: e.teamId ?? null,
    player_id: e.playerId,
    action: e.action,
    point_team_id: e.pointTeamId ?? null,
  }))
  const { error } = await supabase
    .from('volleyball_events')
    .upsert(rows, { onConflict: 'match_id,seq' })
  if (error) throw error
}

export async function getVolleyballEvents(matchId) {
  const { data, error } = await supabase
    .from('volleyball_events')
    .select('*')
    .eq('match_id', matchId)
    .order('seq', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    seq: row.seq,
    setNumber: row.set_number,
    teamId: row.team_id,
    playerId: row.player_id,
    action: row.action,
    pointTeamId: row.point_team_id,
  }))
}

function emptyStats() {
  return {
    kills: 0,
    attackErrors: 0,
    attackAttempts: 0, // kills + non-scoring attacks + attack errors
    aces: 0,
    serviceErrors: 0,
    blocks: 0,
    digs: 0,
    assists: 0,
  }
}

/** Turns a list of events into a Map of playerId -> stat totals. */
export function summarizeEvents(events) {
  const byPlayer = new Map()
  for (const e of events) {
    if (!e.playerId) continue
    if (!byPlayer.has(e.playerId)) byPlayer.set(e.playerId, emptyStats())
    const s = byPlayer.get(e.playerId)
    switch (e.action) {
      case 'kill':
        s.kills += 1
        s.attackAttempts += 1
        break
      case 'attack':
        s.attackAttempts += 1
        break
      case 'attack_error':
        s.attackErrors += 1
        s.attackAttempts += 1
        break
      case 'ace':
        s.aces += 1
        break
      case 'service_error':
        s.serviceErrors += 1
        break
      case 'block':
        s.blocks += 1
        break
      case 'dig':
        s.digs += 1
        break
      case 'assist':
        s.assists += 1
        break
      default:
        break
    }
  }
  return byPlayer
}

/** Hitting % = (kills - errors) / attempts. Returns null if no attempts. */
export function hittingPercentage(stats) {
  if (!stats || stats.attackAttempts === 0) return null
  return (stats.kills - stats.attackErrors) / stats.attackAttempts
}

/** Formats a hitting % the way volleyball box scores do: .250, -.100, or '--'. */
export function formatHitting(value) {
  if (value === null || value === undefined) return '--'
  return value.toFixed(3).replace(/^(-?)0/, '$1')
}

// ---------- Leaderboards ----------

/** Attacks a player needs before they can appear on the hitting % board. */
export const MIN_ATTACK_ATTEMPTS = 10

/** Pages through a query so a long tournament isn't cut off at 1000 rows. */
async function fetchAllRows(buildQuery) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

/**
 * Player leaderboard for volleyball, built from volleyball_events.
 * statKey: 'kills' | 'aces' | 'blocks' | 'digs' | 'assists' | 'hitting'
 * Scope is one tournament (tournamentId set) or a player's whole career
 * (tournamentId null). Only completed matches count.
 *
 * Returns rows shaped like the basketball board ({ playerId, playerName,
 * games, total, average }) plus `display` (text to show) and `detail`.
 */
export async function getVolleyballPlayerLeaderboard(
  statKey,
  { tournamentId = null, minGames = 1, mode = 'total' } = {}
) {
  const rows = await fetchAllRows(() => {
    let q = supabase
      .from('volleyball_events')
      .select('player_id, match_id, action, players(name), matches!inner(tournament_id, status)')
      .eq('matches.status', 'completed')
      .order('seq', { ascending: true })
      .order('match_id', { ascending: true })
    if (tournamentId) q = q.eq('matches.tournament_id', tournamentId)
    return q
  })

  const byPlayer = new Map()
  for (const row of rows) {
    if (!row.player_id) continue
    if (!byPlayer.has(row.player_id)) {
      byPlayer.set(row.player_id, {
        playerId: row.player_id,
        playerName: row.players?.name ?? 'Unknown player',
        matches: new Set(),
        events: [],
      })
    }
    const p = byPlayer.get(row.player_id)
    p.matches.add(row.match_id)
    p.events.push({ playerId: row.player_id, action: row.action })
  }

  let list = []
  for (const p of byPlayer.values()) {
    const stats = summarizeEvents(p.events).get(p.playerId)
    const games = p.matches.size

    if (statKey === 'hitting') {
      if (stats.attackAttempts < MIN_ATTACK_ATTEMPTS) continue
      const value = hittingPercentage(stats)
      list.push({
        playerId: p.playerId,
        playerName: p.playerName,
        games,
        total: value,
        average: value,
        display: formatHitting(value),
        detail: `${stats.kills}K ${stats.attackErrors}E ${stats.attackAttempts}TA`,
      })
      continue
    }

    const field = { kills: 'kills', aces: 'aces', blocks: 'blocks', digs: 'digs', assists: 'assists' }[statKey]
    if (!field) throw new Error(`Unknown stat: ${statKey}`)
    const total = stats[field]
    list.push({
      playerId: p.playerId,
      playerName: p.playerName,
      games,
      total,
      average: games ? total / games : 0,
      display: mode === 'average' ? (games ? total / games : 0).toFixed(1) : String(total),
      detail: null,
    })
  }

  if (statKey !== 'hitting' && mode === 'average') {
    list = list.filter((p) => p.games >= minGames)
    list.sort((a, b) => b.average - a.average)
  } else {
    list.sort((a, b) => b.total - a.total)
  }
  return list
}

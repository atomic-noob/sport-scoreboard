import { supabase } from './supabaseClient'
import { getTeamsForTournament } from './adminData'
import { getMatchesForTournament } from './matchesData'

/**
 * Team leaderboard is always scoped to a single tournament -- unlike
 * players, teams aren't global entities (a "Red Falcons" in one
 * tournament is a completely different row from a "Red Falcons" in
 * another), so a cross-tournament team board wouldn't mean anything.
 *
 * Forfeited games count toward win/loss record but are excluded from
 * points-for/against and average score, since there's no real score
 * attached to a forfeit.
 */
export async function getTeamLeaderboard(tournamentId) {
  const [teams, matches] = await Promise.all([
    getTeamsForTournament(tournamentId),
    getMatchesForTournament(tournamentId),
  ])

  const byTeam = {}
  teams.forEach((t) => {
    byTeam[t.id] = { team: t, wins: 0, losses: 0, gamesScored: 0, pointsFor: 0, pointsAgainst: 0 }
  })

  for (const m of matches) {
    if (!m.teamAId || !m.teamBId) continue
    if (m.status !== 'completed' && m.status !== 'forfeit') continue

    const aRow = byTeam[m.teamAId]
    const bRow = byTeam[m.teamBId]
    if (!aRow || !bRow) continue

    if (m.winnerTeamId === m.teamAId) {
      aRow.wins++
      bRow.losses++
    } else if (m.winnerTeamId === m.teamBId) {
      bRow.wins++
      aRow.losses++
    }

    if (m.status === 'completed') {
      aRow.gamesScored++
      bRow.gamesScored++
      aRow.pointsFor += m.teamAScore ?? 0
      aRow.pointsAgainst += m.teamBScore ?? 0
      bRow.pointsFor += m.teamBScore ?? 0
      bRow.pointsAgainst += m.teamAScore ?? 0
    }
  }

  return Object.values(byTeam).map((r) => ({
    ...r,
    avgScore: r.gamesScored ? r.pointsFor / r.gamesScored : 0,
    pointDiff: r.pointsFor - r.pointsAgainst,
  }))
}

const PLAYER_STAT_COLUMNS = {
  points: 'points',
  rebounds: 'rebounds',
  assists: 'assists',
  steals: 'steals',
  blocks: 'blocks',
}

/**
 * Player leaderboard for a single stat category. Scope is either one
 * tournament (tournamentId set) or global/career (tournamentId null,
 * aggregating across every tournament that player has ever played in --
 * this works because players ARE global entities, unlike teams).
 *
 * Only completed games count (forfeits have no real stat line attached).
 */
export async function getPlayerLeaderboard(statKey, { tournamentId = null, minGames = 1, mode = 'total' } = {}) {
  const column = PLAYER_STAT_COLUMNS[statKey]
  if (!column) throw new Error(`Unknown stat: ${statKey}`)

  let query = supabase
    .from('match_player_stats')
    .select(`player_id, ${column}, players(name), matches!inner(tournament_id, status)`)
    .eq('matches.status', 'completed')

  if (tournamentId) {
    query = query.eq('matches.tournament_id', tournamentId)
  }

  const { data, error } = await query
  if (error) throw error

  const byPlayer = {}
  for (const row of data) {
    const pid = row.player_id
    if (!byPlayer[pid]) {
      byPlayer[pid] = { playerId: pid, playerName: row.players?.name ?? 'Unknown player', games: 0, total: 0 }
    }
    byPlayer[pid].games += 1
    byPlayer[pid].total += row[column] ?? 0
  }

  let list = Object.values(byPlayer).map((p) => ({ ...p, average: p.games ? p.total / p.games : 0 }))

  if (mode === 'average') {
    list = list.filter((p) => p.games >= minGames)
    list.sort((a, b) => b.average - a.average)
  } else {
    list.sort((a, b) => b.total - a.total)
  }

  return list
}

import { supabase } from './supabaseClient'

/**
 * Tournament format engine: round-robin schedule generation, standings
 * computation, and the elimination bracket algorithm (seeding + the
 * single play-in game for odd counts + byes for non-power-of-2 fields).
 *
 * Algorithm recap (as designed):
 *  - Round-robin: every team plays every other team `gamesPerMatchup` times.
 *  - Elimination seeding: take the top N teams by standings (or by manual
 *    seed order if no round-robin games exist yet).
 *  - If N is odd: the two LOWEST of those N seeds play a single play-in
 *    game. The loser is out; the winner takes the last spot, bringing
 *    the field to an even number.
 *  - If the resulting even field still isn't a clean power of 2, the
 *    TOP seeds get byes in round 1 (skip straight to round 2).
 *  - Remaining teams are paired standard bracket style: 1 vs lowest, 2
 *    vs next-lowest, etc.
 */

function matchFromRow(row) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    phase: row.phase,
    round: row.round,
    bracketPosition: row.bracket_position,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    winnerTeamId: row.winner_team_id,
    status: row.status,
    forfeitTeamId: row.forfeit_team_id,
    scheduledAt: row.scheduled_at,
    createdAt: row.created_at,
  }
}

// ---------- Format config ----------

export async function setFormatConfig(tournamentId, formatConfig) {
  const { error } = await supabase
    .from('tournaments')
    .update({ format_config: formatConfig })
    .eq('id', tournamentId)
  if (error) throw error
}

// ---------- Matches ----------

export async function getMatchesForTournament(tournamentId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })

  if (error) throw error
  return data.map(matchFromRow)
}

async function insertMatches(rows) {
  if (rows.length === 0) return []
  const { data, error } = await supabase.from('matches').insert(rows).select()
  if (error) throw error
  return data.map(matchFromRow)
}

/** Deletes all round-robin matches for a tournament (used before regenerating). */
export async function clearRoundRobinMatches(tournamentId) {
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('phase', 'round_robin')
  if (error) throw error
}

/**
 * Generates the full round-robin schedule: every team plays every other
 * team `gamesPerMatchup` times. Order of teams passed in doesn't affect
 * who plays whom (round-robin is every pair regardless), only display.
 */
export async function generateRoundRobinSchedule(tournamentId, teamIds, gamesPerMatchup = 1) {
  await clearRoundRobinMatches(tournamentId)

  const rows = []
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      for (let g = 0; g < gamesPerMatchup; g++) {
        rows.push({
          tournament_id: tournamentId,
          phase: 'round_robin',
          round: 0,
          team_a_id: teamIds[i],
          team_b_id: teamIds[j],
          status: 'scheduled',
        })
      }
    }
  }

  return insertMatches(rows)
}

// ---------- Standings ----------

/**
 * Computes W-L standings from completed round-robin matches.
 * Ranked by win %, tiebreak by point differential (points for - against).
 * Teams with zero games played are included (0-0), ranked last.
 */
export function computeStandings(teams, matches) {
  const stats = new Map(
    teams.map((t) => [t.id, { team: t, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }])
  )

  const roundRobinCompleted = matches.filter(
    (m) => m.phase === 'round_robin' && m.status === 'completed'
  )

  for (const m of roundRobinCompleted) {
    const a = stats.get(m.teamAId)
    const b = stats.get(m.teamBId)
    if (!a || !b) continue

    a.pointsFor += m.teamAScore ?? 0
    a.pointsAgainst += m.teamBScore ?? 0
    b.pointsFor += m.teamBScore ?? 0
    b.pointsAgainst += m.teamAScore ?? 0

    if (m.winnerTeamId === m.teamAId) {
      a.wins += 1
      b.losses += 1
    } else if (m.winnerTeamId === m.teamBId) {
      b.wins += 1
      a.losses += 1
    }
  }

  const standings = Array.from(stats.values()).map((s) => {
    const gamesPlayed = s.wins + s.losses
    return {
      ...s,
      gamesPlayed,
      winPct: gamesPlayed === 0 ? 0 : s.wins / gamesPlayed,
      pointDiff: s.pointsFor - s.pointsAgainst,
    }
  })

  standings.sort((x, y) => {
    if (y.winPct !== x.winPct) return y.winPct - x.winPct
    if (y.pointDiff !== x.pointDiff) return y.pointDiff - x.pointDiff
    return 0
  })

  return standings
}

// ---------- Elimination bracket generation ----------

function nextPowerOfTwoAtLeast(n) {
  let size = 1
  while (size < n) size *= 2
  return size
}

/**
 * Runs the full seeding algorithm and writes the resulting matches
 * (play-in game if needed, plus round-1 elimination matchups with byes
 * for top seeds if the field isn't a clean power of 2).
 *
 * `orderedTeamIds` should already be ranked best-to-worst (from
 * computeStandings, or manual seed order if round-robin hasn't run).
 */
export async function generateEliminationBracket(tournamentId, orderedTeamIds, teamsAdvancing) {
  // Clear any previous elimination/play-in matches before regenerating
  const { error: clearError } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .in('phase', ['play_in', 'elimination'])
  if (clearError) throw clearError

  let field = orderedTeamIds.slice(0, teamsAdvancing) // best-to-worst seed order
  const rows = []
  let playInMatch = null

  // Odd count: bottom 2 seeds play a single play-in game.
  if (field.length % 2 !== 0) {
    const seedLow1 = field[field.length - 2]
    const seedLow2 = field[field.length - 1]
    playInMatch = {
      tournament_id: tournamentId,
      phase: 'play_in',
      round: 0,
      team_a_id: seedLow1,
      team_b_id: seedLow2,
      status: 'scheduled',
    }
    rows.push(playInMatch)
    // Remove the two play-in teams from the field for now -- the winner
    // (unknown yet) will take the last bracket slot once decided.
    field = field.slice(0, field.length - 2)
  }

  const bracketSize = nextPowerOfTwoAtLeast(field.length + (playInMatch ? 1 : 0))
  const byeCount = bracketSize - field.length - (playInMatch ? 1 : 0)

  // Top `byeCount` seeds get a bye (auto-advance, no round-1 opponent).
  const byeTeams = field.slice(0, byeCount)
  const playingTeams = field.slice(byeCount)

  for (const teamId of byeTeams) {
    rows.push({
      tournament_id: tournamentId,
      phase: 'elimination',
      round: 1,
      team_a_id: teamId,
      team_b_id: null,
      status: 'bye',
      winner_team_id: teamId,
    })
  }

  // Standard bracket pairing: best remaining seed vs worst remaining seed.
  let lo = 0
  let hi = playingTeams.length - 1
  let position = 0
  while (lo < hi) {
    rows.push({
      tournament_id: tournamentId,
      phase: 'elimination',
      round: 1,
      bracket_position: position++,
      team_a_id: playingTeams[lo],
      team_b_id: playingTeams[hi],
      status: 'scheduled',
    })
    lo++
    hi--
  }

  // If there's a play-in winner still pending, reserve the last slot --
  // team_b_id is null for now; once the play-in match completes, call
  // fillPlayInWinnerSlot() to patch this match with the actual winner.
  if (playInMatch) {
    rows.push({
      tournament_id: tournamentId,
      phase: 'elimination',
      round: 1,
      bracket_position: position++,
      team_a_id: playingTeams.length > 0 ? null : field[0] ?? null,
      team_b_id: null,
      status: 'scheduled',
    })
  }

  return insertMatches(rows)
}

/**
 * Call this after a play-in match is marked completed. Finds the
 * elimination match still waiting on the play-in winner and fills it in.
 */
export async function fillPlayInWinnerSlot(tournamentId, playInWinnerTeamId) {
  const { data: pending, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('phase', 'elimination')
    .eq('round', 1)
    .is('team_a_id', null)
    .is('team_b_id', null)
    .limit(1)

  if (error) throw error
  if (!pending || pending.length === 0) return null

  const { data, error: updateError } = await supabase
    .from('matches')
    .update({ team_a_id: playInWinnerTeamId })
    .eq('id', pending[0].id)
    .select()
    .single()

  if (updateError) throw updateError
  return matchFromRow(data)
}

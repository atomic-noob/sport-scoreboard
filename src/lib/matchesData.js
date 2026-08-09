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
    potgPlayerId: row.potg_player_id,
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
 * Classic "circle method" round-robin scheduling: arranges every team
 * into fair rounds where each team plays exactly one game per round
 * (or sits out once, if the team count is odd -- byes rotate evenly).
 * Returns an array of rounds, each an array of [teamIdA, teamIdB] pairs.
 *
 * Taking just the first N rounds of this (instead of all of them) is
 * how we generate a "fixed number of games per team" schedule fairly --
 * every team has played a distinct opponent in each round so far, so
 * nobody's stuck facing the same team twice while others get variety.
 */
function circleMethodRounds(teamIds) {
  let arr = [...teamIds]
  if (arr.length % 2 !== 0) arr.push(null) // null = bye slot
  const n = arr.length
  const totalRounds = n - 1
  const rounds = []

  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== null && b !== null) roundMatches.push([a, b])
    }
    rounds.push(roundMatches)
    // Rotate everyone except the first team stays fixed
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }

  return rounds
}

/**
 * Generates a round-robin schedule where each team plays a FIXED number
 * of games (not the full round-robin field) -- the format common in
 * local/barangay leagues where time doesn't allow everyone-plays-everyone.
 * Uses the circle method so games are spread fairly: taking the first
 * `gamesPerTeam` rounds guarantees no accidental double-matchups and
 * reasonably even scheduling. NOTE: if the team count is odd, a team's
 * single bye round might land inside or outside the rounds taken, so
 * final game counts can differ by at most 1 game between teams -- this
 * is an inherent tradeoff of odd fields, not a bug.
 */
export async function generateLimitedRoundRobinSchedule(tournamentId, teamIds, gamesPerTeam) {
  await clearRoundRobinMatches(tournamentId)

  const allRounds = circleMethodRounds(teamIds)
  const roundsToUse = allRounds.slice(0, Math.min(gamesPerTeam, allRounds.length))

  const rows = []
  for (const round of roundsToUse) {
    for (const [teamA, teamB] of round) {
      rows.push({
        tournament_id: tournamentId,
        phase: 'round_robin',
        round: 0,
        team_a_id: teamA,
        team_b_id: teamB,
        status: 'scheduled',
      })
    }
  }

  return insertMatches(rows)
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

  // bracket_position is assigned sequentially across ALL round-1 slots
  // (byes, playing pairs, and the play-in-reserved slot) so round 2
  // knows how to pair them up: position 2i and 2i+1 feed into round-2
  // position i.
  let pos = 0

  for (const teamId of byeTeams) {
    rows.push({
      tournament_id: tournamentId,
      phase: 'elimination',
      round: 1,
      bracket_position: pos++,
      team_a_id: teamId,
      team_b_id: null,
      status: 'bye',
      winner_team_id: teamId,
    })
  }

  // Standard bracket pairing: best remaining seed vs worst remaining seed.
  let lo = 0
  let hi = playingTeams.length - 1
  while (lo < hi) {
    rows.push({
      tournament_id: tournamentId,
      phase: 'elimination',
      round: 1,
      bracket_position: pos++,
      team_a_id: playingTeams[lo],
      team_b_id: playingTeams[hi],
      status: 'scheduled',
    })
    lo++
    hi--
  }

  // If there's a play-in winner still pending, reserve the last slot --
  // team_a_id/team_b_id are null for now; fillPlayInWinnerSlot() patches
  // this once the play-in match completes.
  if (playInMatch) {
    rows.push({
      tournament_id: tournamentId,
      phase: 'elimination',
      round: 1,
      bracket_position: pos++,
      team_a_id: null,
      team_b_id: null,
      status: 'scheduled',
    })
  }

  const inserted = await insertMatches(rows)

  // Bye "winners" are already decided -- push them straight into round 2
  // now instead of waiting for a game that will never happen.
  for (const match of inserted) {
    if (match.status === 'bye') {
      await advanceWinner(tournamentId, match, match.winnerTeamId)
    }
  }

  return inserted
}

/**
 * Threads a winner into the next elimination round. If the sibling slot
 * (the other half of this bracket_position pairing) already has a
 * completed/bye match waiting, this fills in the empty side of an
 * existing next-round match; otherwise it creates that next-round match
 * with this winner in the correct slot and the other slot still open.
 * If this was the only match in its round, the winner is the champion --
 * no further round is created.
 */
async function advanceWinner(tournamentId, fromMatch, winnerTeamId) {
  const { count, error: countError } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('phase', 'elimination')
    .eq('round', fromMatch.round)

  if (countError) throw countError
  if (count <= 1) return { champion: winnerTeamId } // last round -- tournament is decided

  const nextRound = fromMatch.round + 1
  const nextPosition = Math.floor(fromMatch.bracketPosition / 2)
  const isTeamA = fromMatch.bracketPosition % 2 === 0

  const { data: existing, error: findError } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('phase', 'elimination')
    .eq('round', nextRound)
    .eq('bracket_position', nextPosition)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error: updateError } = await supabase
      .from('matches')
      .update(isTeamA ? { team_a_id: winnerTeamId } : { team_b_id: winnerTeamId })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return null
  }

  const { error: insertError } = await supabase.from('matches').insert({
    tournament_id: tournamentId,
    phase: 'elimination',
    round: nextRound,
    bracket_position: nextPosition,
    team_a_id: isTeamA ? winnerTeamId : null,
    team_b_id: isTeamA ? null : winnerTeamId,
    status: 'scheduled',
  })
  if (insertError) throw insertError
  return null
}

/** Fetches a single match by id. */
export async function getMatch(matchId) {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).single()
  if (error) throw error
  return matchFromRow(data)
}

/**
 * Marks a match as live -- called when a scorer actually starts playing
 * it (from the lineup screen). This is what lets the public "Watch Live"
 * pages show it as in-progress instead of just "scheduled" or, worse,
 * invisible until it's already over.
 */
export async function markMatchLive(matchId) {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'live' })
    .eq('id', matchId)
    .eq('status', 'scheduled') // don't clobber completed/forfeit if called again
  if (error) throw error
}

/**
 * Records a final result for a match and advances the winner:
 *  - round_robin: just marks it complete (standings recompute automatically)
 *  - play_in: marks it complete, then fills the winner into the waiting
 *    round-1 elimination slot
 *  - elimination: marks it complete, then threads the winner into the
 *    next round (or declares them champion if this was the final)
 */
/**
 * Records a final result for a match and advances the winner. Also
 * optionally saves the per-player box score and Player of the Game --
 * pass `playerStats` (array of { playerId, teamId, points, fouls,
 * turnovers }) and `potgPlayerId` when the caller has that data (the
 * live scoreboard does; a quick manual score entry might not).
 */
export async function completeMatch(matchId, teamAScore, teamBScore, options = {}) {
  const { playerStats = [], potgPlayerId = null } = options
  const match = await getMatch(matchId)
  const winnerTeamId = teamAScore > teamBScore ? match.teamAId : match.teamBId

  const { error } = await supabase
    .from('matches')
    .update({
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      winner_team_id: winnerTeamId,
      status: 'completed',
      potg_player_id: potgPlayerId,
    })
    .eq('id', matchId)
  if (error) throw error

  if (playerStats.length > 0) {
    const rows = playerStats.map((p) => ({
      match_id: matchId,
      player_id: p.playerId,
      team_id: p.teamId,
      points: p.points ?? 0,
      fouls: p.fouls ?? 0,
      turnovers: p.turnovers ?? 0,
      assists: p.assists ?? 0,
      rebounds: p.rebounds ?? 0,
      steals: p.steals ?? 0,
      blocks: p.blocks ?? 0,
      technical_fouls: p.technicalFouls ?? 0,
      fg_made: p.fgMade ?? 0,
      fg_attempted: p.fgAttempted ?? 0,
    }))
    const { error: statsError } = await supabase.from('match_player_stats').insert(rows)
    if (statsError) {
      // Don't fail the whole match completion over stats -- the result
      // itself (score, winner, bracket advancement) matters more.
      console.warn('Could not save player stats for this match:', statsError.message)
    }
  }

  const updated = { ...match, teamAScore, teamBScore, winnerTeamId, status: 'completed', potgPlayerId }

  if (match.phase === 'play_in') {
    await fillPlayInWinnerSlot(match.tournamentId, winnerTeamId)
  } else if (match.phase === 'elimination') {
    await advanceWinner(match.tournamentId, updated, winnerTeamId)
  }

  return updated
}

/**
 * Marks a match as forfeited by one team. The other team is recorded as
 * the winner and advances through the bracket exactly like a normally
 * completed match -- forfeits shouldn't stall a tournament.
 */
export async function forfeitMatch(matchId, forfeitingTeamId) {
  const match = await getMatch(matchId)
  const winnerTeamId = forfeitingTeamId === match.teamAId ? match.teamBId : match.teamAId

  const { error } = await supabase
    .from('matches')
    .update({
      status: 'forfeit',
      forfeit_team_id: forfeitingTeamId,
      winner_team_id: winnerTeamId,
    })
    .eq('id', matchId)
  if (error) throw error

  const updated = { ...match, status: 'forfeit', forfeitTeamId: forfeitingTeamId, winnerTeamId }

  if (match.phase === 'play_in') {
    await fillPlayInWinnerSlot(match.tournamentId, winnerTeamId)
  } else if (match.phase === 'elimination') {
    await advanceWinner(match.tournamentId, updated, winnerTeamId)
  }

  return updated
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

/**
 * Saves the full action log permanently. Called at match completion --
 * the live version (in match_live_state) gets deleted once the game is
 * done, so this is what actually keeps the audit trail around.
 */
export async function saveActionLog(matchId, actionLog) {
  const { error } = await supabase
    .from('match_action_log')
    .upsert({ match_id: matchId, log: actionLog })
  if (error) console.warn('Could not save permanent action log:', error.message)
}

/** Fetches the permanent action log for a completed match, if one was saved. */
export async function getActionLog(matchId) {
  const { data, error } = await supabase
    .from('match_action_log')
    .select('log')
    .eq('match_id', matchId)
    .maybeSingle()
  if (error) {
    console.warn('Could not fetch action log:', error.message)
    return null
  }
  return data?.log ?? null
}

/**
 * Fetches the final box score for a completed match -- one row per
 * player with their full stat line, joined with player names.
 */
export async function getMatchBoxScore(matchId) {
  const { data, error } = await supabase
    .from('match_player_stats')
    .select('*, players(name)')
    .eq('match_id', matchId)

  if (error) throw error

  return (data ?? []).map((row) => ({
    playerId: row.player_id,
    teamId: row.team_id,
    playerName: row.players?.name ?? 'Unknown player',
    points: row.points,
    fouls: row.fouls,
    turnovers: row.turnovers,
    assists: row.assists,
    rebounds: row.rebounds,
    steals: row.steals,
    blocks: row.blocks,
    technicalFouls: row.technical_fouls,
    fgMade: row.fg_made,
    fgAttempted: row.fg_attempted,
  }))
}

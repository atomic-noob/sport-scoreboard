import { db } from './db'

/**
 * Data layer for tournaments/teams/players/rosters.
 *
 * IMPORTANT: These functions currently read/write to local IndexedDB
 * (via the `adminCache` tables below) because Supabase isn't connected
 * yet. Every function here is written to match the shape the real
 * Supabase queries will eventually have, so when we wire up Supabase
 * at home, we swap the function bodies (not the call sites).
 *
 * Table shapes intentionally mirror what will become Postgres tables:
 *   tournaments(id, name, sport, rules, created_at)
 *   teams(id, tournament_id, name, created_at)
 *   players(id, name, photo_url, created_at)  -- GLOBAL, not tournament-scoped
 *   team_rosters(id, team_id, player_id, jersey_number)
 */

// --- Local-only tables for pre-Supabase development ---
db.version(2).stores({
  pendingEvents: '++id, localId, matchId, eventType, createdAt, synced',
  matchCache: 'matchId, tournamentId, updatedAt',
  rosterCache: 'teamId, tournamentId, updatedAt',

  // New local-dev tables (will be replaced by Supabase queries later)
  tournaments: 'id, name, sport, createdAt',
  teams: 'id, tournamentId, name, createdAt',
  players: 'id, name, createdAt', // GLOBAL players table
  teamRosters: 'id, teamId, playerId, jerseyNumber',
})

const uuid = () => crypto.randomUUID()

// ---------- Tournaments ----------

export async function createTournament({ name, sport = 'basketball', rules, startDate = null, pin = null }) {
  const tournament = {
    id: uuid(),
    name,
    sport,
    rules, // { quarterMinutes, foulLimit, otMinutes, timeoutsPerTeam, maxRosterSize, avgStatMinGames }
    startDate, // ISO date string, e.g. "2026-08-15". Null = not scheduled yet.
    pin, // string PIN gating edits to this tournament. Null = no PIN set.
    createdAt: new Date().toISOString(),
  }
  await db.tournaments.add(tournament)
  return tournament
}

export async function getTournaments() {
  return db.tournaments.orderBy('createdAt').reverse().toArray()
}

export async function getTournament(id) {
  return db.tournaments.get(id)
}

/** Updates any subset of tournament fields (name, rules, startDate, pin). */
export async function updateTournament(id, updates) {
  await db.tournaments.update(id, updates)
  return db.tournaments.get(id)
}

/**
 * A tournament is "locked" (details can't be edited) once its start date
 * has arrived/passed. No start date set = never locked yet.
 */
export function isTournamentLocked(tournament) {
  if (!tournament?.startDate) return false
  return new Date(tournament.startDate) <= new Date()
}

// ---------- Teams ----------

export async function createTeam(tournamentId, name) {
  const team = { id: uuid(), tournamentId, name, createdAt: new Date().toISOString() }
  await db.teams.add(team)
  return team
}

export async function getTeamsForTournament(tournamentId) {
  return db.teams.where('tournamentId').equals(tournamentId).toArray()
}

// ---------- Global players ----------

/** Search the GLOBAL players table by name (case-insensitive substring match). */
export async function searchPlayers(query) {
  if (!query || query.trim().length === 0) return []
  const q = query.trim().toLowerCase()
  const all = await db.players.toArray()
  return all.filter((p) => p.name.toLowerCase().includes(q))
}

/** Creates a new global player profile. Called when no search match is found. */
export async function createPlayer({ name, photoUrl = null }) {
  const player = { id: uuid(), name, photoUrl, createdAt: new Date().toISOString() }
  await db.players.add(player)
  return player
}

// ---------- Team rosters (links a global player to a team, tournament-scoped jersey #) ----------

export async function addPlayerToRoster(teamId, playerId, jerseyNumber) {
  const entry = { id: uuid(), teamId, playerId, jerseyNumber }
  await db.teamRosters.add(entry)
  return entry
}

export async function getRosterForTeam(teamId) {
  const rosterEntries = await db.teamRosters.where('teamId').equals(teamId).toArray()
  const players = await Promise.all(
    rosterEntries.map(async (entry) => {
      const player = await db.players.get(entry.playerId)
      return { ...player, jerseyNumber: entry.jerseyNumber, rosterEntryId: entry.id }
    })
  )
  return players
}

export async function removeFromRoster(rosterEntryId) {
  await db.teamRosters.delete(rosterEntryId)
}

export async function updateJerseyNumber(rosterEntryId, jerseyNumber) {
  await db.teamRosters.update(rosterEntryId, { jerseyNumber })
}

/**
 * Checks if a player is already rostered on a DIFFERENT team within the
 * same tournament. Returns { rosterEntryId, team } if found, else null.
 */
export async function findPlayerTeamInTournament(playerId, tournamentId, excludeTeamId) {
  const teams = await getTeamsForTournament(tournamentId)
  for (const team of teams) {
    if (team.id === excludeTeamId) continue
    const entry = await db.teamRosters
      .where('teamId')
      .equals(team.id)
      .and((e) => e.playerId === playerId)
      .first()
    if (entry) {
      return { rosterEntryId: entry.id, team }
    }
  }
  return null
}

/**
 * Moves a player from one team to another within the same tournament:
 * removes their old roster entry and adds a new one on the destination team.
 */
export async function transferPlayerToTeam(oldRosterEntryId, newTeamId, playerId, jerseyNumber) {
  await db.teamRosters.delete(oldRosterEntryId)
  return addPlayerToRoster(newTeamId, playerId, jerseyNumber)
}

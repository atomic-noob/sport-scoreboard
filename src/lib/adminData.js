import { db } from './db'
import { supabase } from './supabaseClient'

/**
 * Data layer for tournaments/teams/players/rosters.
 *
 * Now backed by real Supabase tables. Every read/write goes to Supabase
 * first; successful reads are also cached into local IndexedDB so the
 * app still shows (slightly stale) data when offline. Writes made while
 * offline will currently fail with an error -- true offline WRITE support
 * for admin data (queue + sync, like we built for match events) is a
 * later step; for now this at least means the app doesn't crash offline,
 * and previously-loaded data still displays.
 */

// ---------- Mapping helpers (camelCase local <-> snake_case Postgres) ----------

function tournamentFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    sport: row.sport,
    rules: row.rules,
    startDate: row.start_date,
    pin: row.pin,
    formatConfig: row.format_config,
    level: row.level,
    organizerType: row.organizer_type,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
  }
}

function teamFromRow(row) {
  return { id: row.id, tournamentId: row.tournament_id, name: row.name, createdAt: row.created_at }
}

function playerFromRow(row) {
  return { id: row.id, name: row.name, photoUrl: row.photo_url, playerCode: row.player_code, createdAt: row.created_at }
}

/** Generates a short, human-shareable player code like SYL-8F42K. */
function generatePlayerCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I, easy to read aloud
  let code = ''
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `SYL-${code}`
}

// ---------- Tournaments ----------

export async function createTournament({ name, sport = 'basketball', rules, startDate = null, pin = null, level = null, organizerType = null }) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('You must be signed in to create a tournament.')

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name, sport, rules, start_date: startDate, pin, created_by: userId,
      level, organizer_type: organizerType,
    })
    .select()
    .single()

  if (error) throw error
  const tournament = tournamentFromRow(data)
  await db.tournaments.put(tournament)

  // Remember this as the default Organizer Type for next time.
  if (organizerType) {
    await supabase.from('profiles').upsert({ user_id: userId, organizer_type: organizerType, updated_at: new Date().toISOString() })
  }

  return tournament
}

/** The organizer's saved default Organizer Type, if they've set one before. */
export async function getOrganizerProfile() {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) return null

  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) {
    console.warn('Could not load organizer profile:', error.message)
    return null
  }
  return data ? { organizerType: data.organizer_type } : null
}

export async function getTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Falling back to local cache for tournaments (offline?):', error.message)
    return db.tournaments.orderBy('createdAt').reverse().toArray()
  }

  const tournaments = data.map(tournamentFromRow)
  await db.tournaments.bulkPut(tournaments)
  return tournaments
}

export async function getTournament(id) {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single()

  if (error) {
    console.warn('Falling back to local cache for tournament (offline?):', error.message)
    return db.tournaments.get(id)
  }

  const tournament = tournamentFromRow(data)
  await db.tournaments.put(tournament)
  return tournament
}

export async function updateTournament(id, updates) {
  const payload = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.rules !== undefined) payload.rules = updates.rules
  if (updates.startDate !== undefined) payload.start_date = updates.startDate
  if (updates.pin !== undefined) payload.pin = updates.pin
  if (updates.level !== undefined) payload.level = updates.level
  if (updates.organizerType !== undefined) payload.organizer_type = updates.organizerType

  const { data, error } = await supabase
    .from('tournaments')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  const tournament = tournamentFromRow(data)
  await db.tournaments.put(tournament)
  return tournament
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
  const { data, error } = await supabase
    .from('teams')
    .insert({ tournament_id: tournamentId, name })
    .select()
    .single()

  if (error) throw error
  const team = teamFromRow(data)
  await db.teams.put(team)
  return team
}

export async function getTeamsForTournament(tournamentId) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)

  if (error) {
    console.warn('Falling back to local cache for teams (offline?):', error.message)
    return db.teams.where('tournamentId').equals(tournamentId).toArray()
  }

  const teams = data.map(teamFromRow)
  await db.teams.bulkPut(teams)
  return teams
}

// ---------- Global players ----------

/** Search the GLOBAL players table by name OR by their SYLVE player code (e.g. SYL-8F42K). */
export async function searchPlayers(query) {
  if (!query || query.trim().length === 0) return []
  const q = query.trim()

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .or(`name.ilike.%${q}%,player_code.ilike.%${q}%`)

  if (error) {
    console.warn('Falling back to local cache for player search (offline?):', error.message)
    const all = await db.players.toArray()
    const lower = q.toLowerCase()
    return all.filter(
      (p) => p.name.toLowerCase().includes(lower) || p.playerCode?.toLowerCase().includes(lower)
    )
  }

  const players = data.map(playerFromRow)
  await db.players.bulkPut(players)
  return players
}

/** Creates a new global player profile. Called when no search match is found. */
export async function createPlayer({ name, photoUrl = null }) {
  // Extremely unlikely to collide (32^5 possibilities), but retry a
  // couple of times just in case rather than fail outright.
  for (let attempt = 0; attempt < 5; attempt++) {
    const playerCode = generatePlayerCode()
    const { data, error } = await supabase
      .from('players')
      .insert({ name, photo_url: photoUrl, player_code: playerCode })
      .select()
      .single()

    if (!error) {
      const player = playerFromRow(data)
      await db.players.put(player)
      return player
    }

    if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
      throw error // a real error, not a code collision -- don't retry
    }
  }
  throw new Error('Could not generate a unique player ID. Please try again.')
}

// ---------- Team rosters ----------

export async function addPlayerToRoster(teamId, playerId, jerseyNumber) {
  const { data, error } = await supabase
    .from('team_rosters')
    .insert({ team_id: teamId, player_id: playerId, jersey_number: jerseyNumber })
    .select()
    .single()

  if (error) throw error
  return { id: data.id, teamId: data.team_id, playerId: data.player_id, jerseyNumber: data.jersey_number }
}

export async function getRosterForTeam(teamId) {
  const { data, error } = await supabase
    .from('team_rosters')
    .select('id, jersey_number, players(id, name, photo_url, player_code, created_at)')
    .eq('team_id', teamId)

  if (error) {
    console.warn('Failed to load roster from Supabase:', error.message)
    return []
  }

  return data.map((entry) => ({
    id: entry.players.id,
    name: entry.players.name,
    photoUrl: entry.players.photo_url,
    playerCode: entry.players.player_code,
    jerseyNumber: entry.jersey_number,
    rosterEntryId: entry.id,
  }))
}

export async function removeFromRoster(rosterEntryId) {
  const { error } = await supabase.from('team_rosters').delete().eq('id', rosterEntryId)
  if (error) throw error
}

export async function updateJerseyNumber(rosterEntryId, jerseyNumber) {
  const { error } = await supabase
    .from('team_rosters')
    .update({ jersey_number: jerseyNumber })
    .eq('id', rosterEntryId)
  if (error) throw error
}

/**
 * Checks if a player is already rostered on a DIFFERENT team within the
 * same tournament. Returns { rosterEntryId, team } if found, else null.
 */
export async function findPlayerTeamInTournament(playerId, tournamentId, excludeTeamId) {
  const { data, error } = await supabase
    .from('team_rosters')
    .select('id, team_id, teams!inner(id, name, tournament_id)')
    .eq('player_id', playerId)
    .eq('teams.tournament_id', tournamentId)

  if (error) {
    console.warn('Could not check for existing roster spot (offline?):', error.message)
    return null
  }

  const match = data.find((entry) => entry.team_id !== excludeTeamId)
  if (!match) return null

  return {
    rosterEntryId: match.id,
    team: { id: match.teams.id, name: match.teams.name },
  }
}

/**
 * Moves a player from one team to another within the same tournament:
 * removes their old roster entry and adds a new one on the destination team.
 */
export async function transferPlayerToTeam(oldRosterEntryId, newTeamId, playerId, jerseyNumber) {
  await removeFromRoster(oldRosterEntryId)
  return addPlayerToRoster(newTeamId, playerId, jerseyNumber)
}

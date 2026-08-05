import Dexie from 'dexie'

// Local-first database. Every scoring action is written here FIRST,
// then queued for sync to Supabase. This is what keeps the app usable
// with no internet connection.
export const db = new Dexie('sportsScoreboardDB')

db.version(1).stores({
  // Queue of events waiting to be pushed to Supabase's match_events table.
  // Events are never deleted here after sync -- we flip `synced` to true
  // and keep them, so the local log always matches the remote log.
  pendingEvents:
    '++id, localId, matchId, eventType, createdAt, synced',

  // Local snapshot of matches currently being scored, so a scorer can
  // close the tab / lose signal and pick right back up.
  matchCache: 'matchId, tournamentId, updatedAt',

  // Local snapshot of team rosters for matches being actively scored,
  // so the court UI works even if the roster fetch happens offline.
  rosterCache: 'teamId, tournamentId, updatedAt',
})

db.version(2).stores({
  pendingEvents: '++id, localId, matchId, eventType, createdAt, synced',
  matchCache: 'matchId, tournamentId, updatedAt',
  rosterCache: 'teamId, tournamentId, updatedAt',

  // Local read-cache mirrors of Supabase's admin tables (tournaments,
  // teams, players, team_rosters). These get populated whenever a
  // Supabase read succeeds, and are used as a fallback when offline.
  tournaments: 'id, name, sport, createdAt',
  teams: 'id, tournamentId, name, createdAt',
  players: 'id, name, createdAt', // GLOBAL players table
  teamRosters: 'id, teamId, playerId, jerseyNumber',
})

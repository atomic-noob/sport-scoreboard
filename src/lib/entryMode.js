/**
 * Singles/doubles sports (badminton, pickleball, tennis) can run in two entry
 * modes. In "players" mode each entry in the tournament IS the player (singles)
 * or the fixed pair (doubles), named after them, with no separate team name and
 * no lineup step. In "teams" mode (and for every tournament made before this
 * option existed) entries are named teams with a roster to pick from per match.
 */
export function getEntryMode(tournament) {
  const rules = tournament?.rules ?? {}
  // Pickleball defaults to doubles, badminton and tennis to singles, when the rule was never saved.
  const fallback = tournament?.sport === 'pickleball' ? 2 : 1
  const perSide = rules.matchType === 'doubles' ? 2 : rules.matchType === 'singles' ? 1 : fallback
  const players = rules.entryType === 'players'
  return {
    players,
    perSide,
    noun: players ? (perSide === 2 ? 'pair' : 'player') : 'team',
    nounPlural: players ? (perSide === 2 ? 'pairs' : 'players') : 'teams',
  }
}

/** Orders a roster to match the entry name ("A / B"): the first named player serves first. */
export function sortByEntryName(roster, entryName) {
  const parts = (entryName ?? '').split(' / ')
  const rank = (p) => {
    const i = parts.indexOf(p.name)
    return i === -1 ? 99 : i
  }
  return [...roster].sort((a, b) => rank(a) - rank(b))
}

/** The display name of an entry made from its players: "Maria Santos" or "Maria Santos / Joy Reyes". */
export function entryNameFromPlayers(names) {
  return names.filter(Boolean).join(' / ')
}

// Per-sport differences for the shared tournament screens.

export const SPORTS = {
  basketball: {
    key: 'basketball',
    label: 'Basketball',
    // Column headings for the public standings table (points for / against).
    standingLabels: { for: 'PF', against: 'PA' },
    defaultRules: {
      quarterMinutes: 10,
      foulLimit: 5,
      otMinutes: 5,
      timeoutsPerTeam: 4,
      maxRosterSize: 15,
      avgStatMinGames: 3,
    },
    ruleFields: [
      { key: 'quarterMinutes', label: 'Quarter length (min)' },
      { key: 'foulLimit', label: 'Foul limit (foul-out)' },
      { key: 'otMinutes', label: 'Overtime length (min)' },
      { key: 'timeoutsPerTeam', label: 'Timeouts per team' },
      { key: 'maxRosterSize', label: 'Max roster size' },
      { key: 'avgStatMinGames', label: 'Min games for avg stats' },
    ],
    summarizeRules: (r) =>
      `${r.quarterMinutes}min quarters · foul-out at ${r.foulLimit} · ${r.timeoutsPerTeam} timeouts/team · max ${r.maxRosterSize} roster`,
    playerStats: [
      { key: 'points', label: 'Points' },
      { key: 'rebounds', label: 'Rebounds' },
      { key: 'assists', label: 'Assists' },
      { key: 'steals', label: 'Steals' },
      { key: 'blocks', label: 'Blocks' },
    ],
    hasPlayerStats: true,
    teamStats: [
      { key: 'wins', label: 'Most Wins' },
      { key: 'avgScore', label: 'Avg Score' },
      { key: 'pointDiff', label: 'Point Differential' },
    ],
  },

  volleyball: {
    key: 'volleyball',
    label: 'Volleyball',
    // matches.team_a_score / team_b_score hold SETS WON for volleyball.
    standingLabels: { for: 'SW', against: 'SL' },
    // Keys match what VolleyballMatchSimulate.jsx reads.
    // setsToWin: 2 = best of 3, 3 = best of 5.
    defaultRules: {
      setsToWin: 2,
      pointsPerSet: 25,
      deciderSetPoints: 15,
      timeoutsPerSet: 2,
      subsPerSet: 6,
      technicalTimeout: 0,
      maxRosterSize: 12,
    },
    ruleFields: [
      {
        key: 'setsToWin',
        label: 'Match format',
        type: 'select',
        options: [
          { value: 2, label: 'Best of 3' },
          { value: 3, label: 'Best of 5' },
        ],
      },
      { key: 'pointsPerSet', label: 'Points per set' },
      { key: 'deciderSetPoints', label: 'Deciding set points' },
      { key: 'timeoutsPerSet', label: 'Timeouts per team per set' },
      { key: 'subsPerSet', label: 'Substitutions per team per set' },
      {
        key: 'technicalTimeout',
        label: 'Technical timeouts (at 8 & 16)',
        type: 'select',
        options: [
          { value: 0, label: 'Off' },
          { value: 1, label: 'On' },
        ],
      },
      { key: 'maxRosterSize', label: 'Max roster size' },
    ],
    summarizeRules: (r) =>
      `Best of ${r.setsToWin * 2 - 1} · sets to ${r.pointsPerSet} (deciding set to ${r.deciderSetPoints}), win by 2 · ${r.timeoutsPerSet} timeouts/set · ${r.subsPerSet ?? 6} subs/set${Number(r.technicalTimeout) ? ' · technical timeouts' : ''} · max ${r.maxRosterSize} roster`,
    // Computed from the volleyball_events table (see volleyballData.js).
    playerStats: [
      { key: 'kills', label: 'Kills' },
      { key: 'aces', label: 'Aces' },
      { key: 'blocks', label: 'Blocks' },
      { key: 'digs', label: 'Digs' },
      { key: 'assists', label: 'Assists' },
      { key: 'hitting', label: 'Hitting %' },
    ],
    hasPlayerStats: true,
    // matches.team_a_score / team_b_score hold SETS WON for volleyball,
    // so the team leaderboard's "score" numbers are set counts.
    teamStats: [
      { key: 'wins', label: 'Most Wins' },
      { key: 'avgScore', label: 'Avg Sets Won' },
      { key: 'pointDiff', label: 'Set Differential' },
    ],
  },
  badminton: {
    key: 'badminton',
    label: 'Badminton',
    // matches.team_a_score / team_b_score hold GAMES WON for badminton
    // (same set-based storage as volleyball: the match_sets table).
    standingLabels: { for: 'GW', against: 'GL' },
    // Rally point scoring (BWF Laws of Badminton): every rally scores, a game
    // goes to `pointsPerGame` and must be won by 2, capped at pointsPerGame + 9
    // (21 -> 30, 15 -> 21). gamesToWin: 2 = best of 3, 1 = a single game.
    // Many clubs still play to 21; the BWF standard becomes 3 x 15 in 2027.
    defaultRules: {
      gamesToWin: 2,
      pointsPerGame: 21,
      matchType: 'singles',
      entryType: 'players',
      maxRosterSize: 6,
    },
    ruleFields: [
      {
        key: 'gamesToWin',
        label: 'Match format',
        type: 'select',
        options: [
          { value: 2, label: 'Best of 3 games' },
          { value: 1, label: 'Single game' },
        ],
      },
      {
        key: 'pointsPerGame',
        label: 'Points per game',
        type: 'select',
        options: [
          { value: 21, label: '21 points (classic)' },
          { value: 15, label: '15 points (BWF 2027)' },
          { value: 11, label: '11 points (short)' },
        ],
      },
      {
        key: 'matchType',
        label: 'Match type',
        type: 'select',
        options: [
          { value: 'singles', label: 'Singles (1 v 1)' },
          { value: 'doubles', label: 'Doubles (2 v 2)' },
        ],
      },
      {
        key: 'entryType',
        label: 'Entries are',
        type: 'select',
        options: [
          { value: 'players', label: 'Players / fixed pairs' },
          { value: 'teams', label: 'Teams with a roster' },
        ],
      },
      { key: 'maxRosterSize', label: 'Max roster size (teams only)' },
    ],
    summarizeRules: (r) =>
      `${Number(r.gamesToWin) === 1 ? 'Single game' : 'Best of 3'} to ${r.pointsPerGame} (win by 2, cap ${Number(r.pointsPerGame) + 9}) · ${r.matchType === 'doubles' ? (r.entryType === 'players' ? 'fixed pairs' : 'doubles') : r.entryType === 'players' ? 'singles players' : 'singles'}${r.entryType === 'players' ? '' : ` · max ${r.maxRosterSize} roster`}`,
    playerStats: [],
    hasPlayerStats: false,
    teamStats: [
      { key: 'wins', label: 'Most Wins' },
      { key: 'avgScore', label: 'Avg Games Won' },
      { key: 'pointDiff', label: 'Game Differential' },
    ],
  },
  pickleball: {
    key: 'pickleball',
    label: 'Pickleball',
    // matches.team_a_score / team_b_score hold GAMES WON for pickleball
    // (same set-based storage as volleyball and badminton: the match_sets table).
    standingLabels: { for: 'GW', against: 'GL' },
    // Traditional side-out scoring (USA Pickleball): only the serving side scores,
    // games go to `pointsPerGame` and are won by 2 (no cap).
    // gamesToWin: 1 = a single game, 2 = best of 3, 3 = best of 5.
    defaultRules: {
      gamesToWin: 2,
      pointsPerGame: 11,
      matchType: 'doubles',
      maxRosterSize: 8,
    },
    ruleFields: [
      {
        key: 'gamesToWin',
        label: 'Match format',
        type: 'select',
        options: [
          { value: 2, label: 'Best of 3 games' },
          { value: 1, label: 'Single game' },
          { value: 3, label: 'Best of 5 games' },
        ],
      },
      {
        key: 'pointsPerGame',
        label: 'Points per game',
        type: 'select',
        options: [
          { value: 11, label: '11 points (standard)' },
          { value: 15, label: '15 points' },
          { value: 21, label: '21 points' },
        ],
      },
      {
        key: 'matchType',
        label: 'Match type',
        type: 'select',
        options: [
          { value: 'doubles', label: 'Doubles (2 v 2)' },
          { value: 'singles', label: 'Singles (1 v 1)' },
        ],
      },
      { key: 'maxRosterSize', label: 'Max roster size' },
    ],
    summarizeRules: (r) =>
      `${Number(r.gamesToWin) === 1 ? 'Single game' : `Best of ${Number(r.gamesToWin) * 2 - 1}`} to ${r.pointsPerGame} (win by 2) · ${r.matchType === 'singles' ? 'singles' : 'doubles'} · max ${r.maxRosterSize} roster`,
    playerStats: [],
    hasPlayerStats: false,
    teamStats: [
      { key: 'wins', label: 'Most Wins' },
      { key: 'avgScore', label: 'Avg Games Won' },
      { key: 'pointDiff', label: 'Game Differential' },
    ],
  },
}

/** Every sport the app knows about, as a list (for filters and pickers). */
export const SPORT_LIST = Object.values(SPORTS)

export function getSportConfig(sport) {
  return SPORTS[sport] ?? SPORTS.basketball
}

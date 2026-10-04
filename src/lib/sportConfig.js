// Per-sport differences for the shared tournament screens.

export const SPORTS = {
  basketball: {
    key: 'basketball',
    label: 'Basketball',
    emoji: '🏀',
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
    emoji: '🏐',
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
}

/** Every sport the app knows about, as a list (for filters and pickers). */
export const SPORT_LIST = Object.values(SPORTS)

export function getSportConfig(sport) {
  return SPORTS[sport] ?? SPORTS.basketball
}

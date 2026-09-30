// Per-sport differences for the shared tournament screens.
// NOTE: the volleyball rule KEYS below (bestOf, setPoints, decidingSetPoints,
// timeoutsPerSet) are my guesses. Make sure they match what
// VolleyballMatchSimulate.jsx / volleyballData.js actually read.

export const SPORTS = {
  basketball: {
    key: 'basketball',
    label: 'Basketball',
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
    defaultRules: {
      bestOf: 3,
      setPoints: 25,
      decidingSetPoints: 15,
      timeoutsPerSet: 2,
      maxRosterSize: 12,
    },
    ruleFields: [
      {
        key: 'bestOf',
        label: 'Match format',
        type: 'select',
        options: [
          { value: 3, label: 'Best of 3' },
          { value: 5, label: 'Best of 5' },
        ],
      },
      { key: 'setPoints', label: 'Points per set' },
      { key: 'decidingSetPoints', label: 'Deciding set points' },
      { key: 'timeoutsPerSet', label: 'Timeouts per team per set' },
      { key: 'maxRosterSize', label: 'Max roster size' },
    ],
    summarizeRules: (r) =>
      `Best of ${r.bestOf} · sets to ${r.setPoints} (deciding set to ${r.decidingSetPoints}), win by 2 · ${r.timeoutsPerSet} timeouts/set · max ${r.maxRosterSize} roster`,
    playerStats: [],
    hasPlayerStats: false,
    // matches.team_a_score / team_b_score hold SETS WON for volleyball,
    // so the team leaderboard's "score" numbers are set counts.
    teamStats: [
      { key: 'wins', label: 'Most Wins' },
      { key: 'avgScore', label: 'Avg Sets Won' },
      { key: 'pointDiff', label: 'Set Differential' },
    ],
  },
}

export function getSportConfig(sport) {
  return SPORTS[sport] ?? SPORTS.basketball
}

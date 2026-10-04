import { useEffect, useState } from 'react'
import { getTeamLeaderboard, getPlayerLeaderboard } from '../../lib/leaderboardData'
import { MIN_ATTACK_ATTEMPTS } from '../../lib/volleyballData'

/**
 * The player and team boards, shared by the organizer's leaderboard page
 * and the public watch page. Which stats appear comes from sportConfig,
 * and the numbers come from leaderboardData.js (one branch per sport).
 */

export function PlayerLeaderboards({ tournamentId, tournament, sportConfig }) {
  const [stat, setStat] = useState('points')
  const [mode, setMode] = useState('total') // 'total' | 'average'
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  const minGames = tournament?.rules?.avgStatMinGames ?? 1

  useEffect(() => {
    setLoading(true)
    setError('')
    getPlayerLeaderboard(stat, { sport: sportConfig.key, tournamentId, minGames, mode })
      .then(setList)
      .catch((err) => {
        console.error('Failed to load player leaderboard:', err)
        setError('Could not load this leaderboard. Check your connection and try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [stat, mode, tournamentId, minGames, sportConfig.key])

  const visible = expanded ? list : list.slice(0, 10)
  const isHitting = stat === 'hitting'

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sportConfig.playerStats.map((s) => (
          <button
            key={s.key}
            onClick={() => { setStat(s.key); setExpanded(false) }}
            className={`text-xs font-medium rounded-full px-3 py-1.5 transition ${
              stat === s.key
                ? 'bg-accent text-white'
                : 'bg-panel border border-line text-ink-dim hover:border-accent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        {isHitting ? (
          <span className="text-[11px] text-ink-faint">
            Min. {MIN_ATTACK_ATTEMPTS} attacks · (kills − errors) ÷ attempts
          </span>
        ) : (
        <div className="flex rounded-lg border border-line overflow-hidden text-xs">
          <button
            onClick={() => setMode('total')}
            className={`px-3 py-1.5 font-medium transition ${mode === 'total' ? 'bg-accent text-on-accent' : 'bg-panel text-ink-dim hover:bg-panel-alt'}`}
          >
            Total
          </button>
          <button
            onClick={() => setMode('average')}
            className={`px-3 py-1.5 font-medium transition ${mode === 'average' ? 'bg-accent text-on-accent' : 'bg-panel text-ink-dim hover:bg-panel-alt'}`}
          >
            Average
          </button>
        </div>
        )}
        {mode === 'average' && !isHitting && (
          <span className="text-[11px] text-ink-faint">Min. {minGames} game{minGames === 1 ? '' : 's'}</span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
      )}

      {loading ? (
        <p className="text-ink-faint text-sm py-6 text-center">Loading...</p>
      ) : visible.length === 0 ? (
        <div className="text-center text-ink-faint py-10 border border-dashed border-line rounded-xl">
          No stats recorded yet.
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((p, i) => (
            <div key={p.playerId} className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-ink-faint w-5 text-right">{i + 1}</span>
                <span className="font-medium text-ink">{p.playerName}</span>
                <span className="text-[11px] text-ink-faint">
                  {p.games} game{p.games === 1 ? '' : 's'}
                  {p.detail ? ` · ${p.detail}` : ''}
                </span>
              </div>
              <span className="font-bold text-ink">{p.display}</span>
            </div>
          ))}
        </div>
      )}

      {!expanded && list.length > 10 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full mt-3 text-xs font-medium text-accent hover:text-accent py-2"
        >
          Show all {list.length} →
        </button>
      )}
    </div>
  )
}

export function TeamLeaderboards({ tournamentId, sportConfig }) {
  const [stat, setStat] = useState('wins')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getTeamLeaderboard(tournamentId)
      .then(setRows)
      .catch((err) => {
        console.error('Failed to load team leaderboard:', err)
        setError('Could not load this leaderboard. Check your connection and try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [tournamentId])

  const sorted = [...rows].sort((a, b) => b[stat] - a[stat])
  const visible = expanded ? sorted : sorted.slice(0, 10)

  function formatValue(r) {
    if (stat === 'avgScore') return r.gamesScored ? r.avgScore.toFixed(1) : '--'
    if (stat === 'pointDiff') return `${r.pointDiff > 0 ? '+' : ''}${r.pointDiff}`
    return r[stat]
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sportConfig.teamStats.map((s) => (
          <button
            key={s.key}
            onClick={() => { setStat(s.key); setExpanded(false) }}
            className={`text-xs font-medium rounded-full px-3 py-1.5 transition ${
              stat === s.key
                ? 'bg-accent text-white'
                : 'bg-panel border border-line text-ink-dim hover:border-accent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
      )}

      {loading ? (
        <p className="text-ink-faint text-sm py-6 text-center">Loading...</p>
      ) : visible.length === 0 ? (
        <div className="text-center text-ink-faint py-10 border border-dashed border-line rounded-xl">
          No completed games yet.
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((r, i) => (
            <div key={r.team.id} className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-ink-faint w-5 text-right">{i + 1}</span>
                <span className="font-medium text-ink">{r.team.name}</span>
                <span className="text-[11px] text-ink-faint">{r.wins}-{r.losses}</span>
              </div>
              <span className="font-bold text-ink">{formatValue(r)}</span>
            </div>
          ))}
        </div>
      )}

      {!expanded && sorted.length > 10 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full mt-3 text-xs font-medium text-accent hover:text-accent py-2"
        >
          Show all {sorted.length} →
        </button>
      )}
    </div>
  )
}

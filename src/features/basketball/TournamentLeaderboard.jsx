import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament } from '../../lib/adminData'
import { getTeamLeaderboard, getPlayerLeaderboard } from '../../lib/leaderboardData'

const PLAYER_STATS = [
  { key: 'points', label: 'Points' },
  { key: 'rebounds', label: 'Rebounds' },
  { key: 'assists', label: 'Assists' },
  { key: 'steals', label: 'Steals' },
  { key: 'blocks', label: 'Blocks' },
]

const TEAM_STATS = [
  { key: 'wins', label: 'Most Wins' },
  { key: 'avgScore', label: 'Avg Score' },
  { key: 'pointDiff', label: 'Point Differential' },
]

export default function TournamentLeaderboard() {
  const { tournamentId } = useParams() // undefined = global/career view
  const isGlobal = !tournamentId

  const [tournament, setTournament] = useState(null)
  const [section, setSection] = useState('players') // 'players' | 'teams'
  const [error, setError] = useState('')

  useEffect(() => {
    if (tournamentId) {
      getTournament(tournamentId)
        .then(setTournament)
        .catch((err) => {
          console.error('Failed to load tournament:', err)
          setError('Could not load this tournament.')
        })
    }
  }, [tournamentId])

  if (tournamentId && !tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-ink-dim">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        ) : (
          'Loading...'
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link
        to={tournamentId ? `/basketball/${tournamentId}/schedule` : '/basketball'}
        className="text-sm text-ink-faint hover:text-ink-dim"
      >
        ← {tournamentId ? 'Back to schedule' : 'Back to tournaments'}
      </Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1">
        {isGlobal ? 'Global Leaderboard' : `${tournament.name} Leaderboard`}
      </h1>
      <p className="text-ink-dim text-sm mb-6">
        {isGlobal
          ? 'Career stats across every tournament a player has ever played.'
          : 'Stats for this tournament only.'}
      </p>

      {!isGlobal && (
        <Link to="/basketball/leaderboard" className="text-xs text-accent hover:text-accent font-medium">
          View global/career leaderboard instead →
        </Link>
      )}

      <div className="flex gap-2 my-6 border-b border-line">
        {['players', 'teams'].map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            disabled={s === 'teams' && isGlobal}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize disabled:opacity-30 disabled:cursor-not-allowed ${
              section === s
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-faint hover:text-ink-dim'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {section === 'teams' && isGlobal && (
        <p className="text-xs text-ink-faint -mt-4 mb-4">
          Team boards aren't available globally, since teams belong to a single tournament.
        </p>
      )}

      {section === 'players' ? (
        <PlayerLeaderboards tournamentId={tournamentId} tournament={tournament} />
      ) : (
        <TeamLeaderboards tournamentId={tournamentId} />
      )}
    </div>
  )
}

function PlayerLeaderboards({ tournamentId, tournament }) {
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
    getPlayerLeaderboard(stat, { tournamentId, minGames, mode })
      .then(setList)
      .catch((err) => {
        console.error('Failed to load player leaderboard:', err)
        setError('Could not load this leaderboard. Check your connection and try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [stat, mode, tournamentId, minGames])

  const visible = expanded ? list : list.slice(0, 10)

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PLAYER_STATS.map((s) => (
          <button
            key={s.key}
            onClick={() => { setStat(s.key); setExpanded(false) }}
            className={`text-xs font-medium rounded-full px-3 py-1.5 transition ${
              stat === s.key
                ? 'bg-accent-soft0 text-white'
                : 'bg-panel border border-line text-ink-dim hover:border-accent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
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
        {mode === 'average' && (
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
                <span className="text-[11px] text-ink-faint">{p.games} game{p.games === 1 ? '' : 's'}</span>
              </div>
              <span className="font-bold text-ink">
                {mode === 'average' ? p.average.toFixed(1) : p.total}
              </span>
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

function TeamLeaderboards({ tournamentId }) {
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
        {TEAM_STATS.map((s) => (
          <button
            key={s.key}
            onClick={() => { setStat(s.key); setExpanded(false) }}
            className={`text-xs font-medium rounded-full px-3 py-1.5 transition ${
              stat === s.key
                ? 'bg-accent-soft0 text-white'
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

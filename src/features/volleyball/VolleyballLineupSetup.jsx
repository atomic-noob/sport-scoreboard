import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, markMatchLive } from '../../lib/matchesData'

function lineupKey(matchId) {
  return `volleyball-lineup:${matchId}`
}

/**
 * Unlike basketball's 5-player lineup (order doesn't matter, just who's
 * on court), volleyball's 6 starters are placed in ROTATION ORDER --
 * the order you tap them in becomes position 1 (server) through
 * position 6, and that order is what the live rotation engine spins
 * through as the set goes on.
 */
export default function VolleyballLineupSetup() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [orderA, setOrderA] = useState([]) // array of player ids, index 0 = position 1 (serves first)
  const [orderB, setOrderB] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [t, m, teams] = await Promise.all([
          getTournament(tournamentId),
          getMatch(matchId),
          getTeamsForTournament(tournamentId),
        ])
        setTournament(t)
        const tA = teams.find((tm) => tm.id === m.teamAId) ?? null
        const tB = teams.find((tm) => tm.id === m.teamBId) ?? null
        setTeamA(tA)
        setTeamB(tB)

        const [rA, rB] = await Promise.all([
          tA ? getRosterForTeam(tA.id) : Promise.resolve([]),
          tB ? getRosterForTeam(tB.id) : Promise.resolve([]),
        ])
        setRosterA(rA)
        setRosterB(rB)

        const saved = sessionStorage.getItem(lineupKey(matchId))
        if (saved) {
          const parsed = JSON.parse(saved)
          setOrderA(parsed.orderA ?? [])
          setOrderB(parsed.orderB ?? [])
        }
      } catch (err) {
        console.error('Failed to load volleyball lineup screen:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  function requiredCount(roster) {
    return Math.min(6, roster.length)
  }

  function tapPlayer(team, playerId) {
    const order = team === 'A' ? orderA : orderB
    const setOrder = team === 'A' ? setOrderA : setOrderB
    const roster = team === 'A' ? rosterA : rosterB
    const max = requiredCount(roster)

    if (order.includes(playerId)) {
      // Tapping an already-placed player removes them AND everyone
      // placed after them, since removing the middle of an ordered
      // sequence would silently renumber everyone's position.
      const idx = order.indexOf(playerId)
      setOrder(order.slice(0, idx))
    } else {
      if (order.length >= max) return
      setOrder([...order, playerId])
    }
  }

  const readyA = orderA.length === requiredCount(rosterA) && rosterA.length > 0
  const readyB = orderB.length === requiredCount(rosterB) && rosterB.length > 0
  const canStart = readyA && readyB

  async function handleStart() {
    if (!canStart) return
    sessionStorage.setItem(lineupKey(matchId), JSON.stringify({ orderA, orderB }))
    try {
      await markMatchLive(matchId)
    } catch (err) {
      console.error('Could not mark match as live:', err)
    }
    setSaving(true)
    navigate(`/volleyball/${tournamentId}/match/${matchId}`)
  }

  if (!tournament || !teamA || !teamB) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-ink-dim">
        {error ? <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div> : 'Loading...'}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col" style={{ minHeight: 'calc(100vh - 20px)' }}>
      <Link to={`/volleyball/${tournamentId}/schedule`} className="text-sm text-ink-faint hover:text-ink-dim shrink-0">
        ← Back to schedule
      </Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1 shrink-0">Starting Rotation</h1>
      <p className="text-ink-dim text-sm mb-4 shrink-0">
        Tap {requiredCount(rosterA)} players per team in serving order -- the first one you tap serves first.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live shrink-0">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-0">
        <RotationColumn team={teamA} roster={rosterA} order={orderA} required={requiredCount(rosterA)} onTap={(id) => tapPlayer('A', id)} />
        <RotationColumn team={teamB} roster={rosterB} order={orderB} required={requiredCount(rosterB)} onTap={(id) => tapPlayer('B', id)} />
      </div>

      <button
        onClick={handleStart}
        disabled={!canStart || saving}
        className="w-full mt-4 rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-3 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        {saving ? 'Starting...' : canStart ? 'Start Set 1' : `Set the serving order for both teams`}
      </button>
    </div>
  )
}

function RotationColumn({ team, roster, order, required, onTap }) {
  return (
    <div className="rounded-xl border border-line bg-panel flex flex-col overflow-hidden min-h-0">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between shrink-0">
        <span className="font-medium text-ink truncate">{team?.name ?? 'TBD'}</span>
        <span className={`text-xs font-medium ${order.length === required ? 'text-accent' : 'text-ink-faint'}`}>
          {order.length} / {required}
        </span>
      </div>

      {order.length > 0 && (
        <div className="px-3 py-2 border-b border-line bg-page shrink-0">
          <p className="text-[10px] font-semibold text-ink-faint uppercase mb-1">Rotation order</p>
          <div className="flex flex-wrap gap-1">
            {order.map((id, i) => {
              const p = roster.find((r) => r.id === id)
              return (
                <span key={id} className="text-xs bg-accent-soft text-accent rounded-full px-2 py-0.5">
                  {i + 1}. {p?.name ?? '?'}{i === 0 && ' (serves)'}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {roster.map((player) => {
            const isPlaced = order.includes(player.id)
            const position = order.indexOf(player.id) + 1
            return (
              <button
                key={player.id}
                onClick={() => onTap(player.id)}
                className={`rounded-lg border-2 px-2 py-2.5 text-left transition ${
                  isPlaced ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-panel-alt'
                }`}
              >
                <span className="text-xs text-ink-faint">#{player.jerseyNumber ?? '--'}</span>
                <span className="block text-sm text-ink truncate">{player.name}</span>
                {isPlaced && <span className="text-[10px] font-medium text-accent">Position {position}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

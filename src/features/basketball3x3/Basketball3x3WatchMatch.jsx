import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, getMatchBoxScore } from '../../lib/matchesData'
import { getCloudMatchState } from '../../lib/liveMatchState'
import { supabase } from '../../lib/supabaseClient'
import { foulPenalty, formatClock } from '../../lib/basketball3x3Rules'
import { TEAM_CLASS } from '../../lib/teamColors'
import ShareSection from '../watch/ShareSection'

/**
 * Public live/final view of a 3x3 game: score, game clock (counted down here
 * between the scorer's updates), team fouls and bonus, the three on court with
 * their points, and the final box score.
 */
export default function Basketball3x3WatchMatch() {
  const { tournamentId, matchId } = useParams()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [liveState, setLiveState] = useState(null)
  const [receivedAt, setReceivedAt] = useState(Date.now())
  const [boxScore, setBoxScore] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const statusRef = useRef(null)

  function receive(state) {
    setLiveState(state)
    setReceivedAt(Date.now())
  }

  async function refresh() {
    try {
      const [t, m] = await Promise.all([getTournament(tournamentId), getMatch(matchId)])
      setTournament(t)
      setMatch(m)
      statusRef.current = m.status
      if (m.status === 'live') {
        receive(await getCloudMatchState(matchId))
      } else if (m.status === 'completed') {
        setBoxScore(await getMatchBoxScore(matchId))
      }
    } catch (err) {
      console.error('Failed to load match:', err)
      setError('Could not load this match. Check your connection and try refreshing.')
    }
  }

  useEffect(() => {
    async function loadTeams() {
      const m = await getMatch(matchId)
      const teams = await getTeamsForTournament(tournamentId)
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
    }
    loadTeams().catch((err) => {
      console.error('Failed to load teams/rosters:', err)
      setError('Could not load this match. Check your connection and try refreshing.')
    })
  }, [tournamentId, matchId])

  useEffect(() => {
    refresh()
    const interval = setInterval(() => {
      if (statusRef.current === null || statusRef.current === 'live') refresh()
    }, 8000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, matchId])

  useEffect(() => {
    const channel = supabase
      .channel(`watch-3x3-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_live_state', filter: `match_id=eq.${matchId}` },
        (payload) => {
          if (payload.new?.state) receive(payload.new.state)
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  // Tick once a second so the clock counts down on screen while it is running.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  if (!tournament || !match) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-4">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        ) : (
          <p className="text-ink-faint">Loading...</p>
        )}
      </div>
    )
  }

  const isLive = match.status === 'live'
  const isCompleted = match.status === 'completed'
  const isForfeit = match.status === 'forfeit'
  const snap = isLive ? liveState : null

  const scoreA = snap ? snap.scoreA : match.teamAScore ?? 0
  const scoreB = snap ? snap.scoreB : match.teamBScore ?? 0
  const clockMs = snap ? Math.max(0, snap.clockMs - (snap.clockRunning ? now - receivedAt : 0)) : 0
  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))

  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-line bg-panel">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to={`/watch/${tournamentId}`} className="text-sm text-ink-faint hover:text-ink-dim truncate">
            ← {tournament.name}
          </Link>
          {isLive && (
            <span className="text-xs font-medium text-live flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        )}

        <div className="rounded-xl border border-line bg-panel p-5 mb-4">
          {isLive && snap && (
            <p className="text-center text-4xl font-display font-bold tabular-nums text-ink mb-1">
              {snap.inOT ? 'OVERTIME' : formatClock(clockMs)}
            </p>
          )}
          {isLive && snap && !snap.inOT && (
            <p className="text-center text-[11px] text-ink-faint mb-3">
              {snap.clockRunning ? 'Clock running' : 'Clock stopped'} · first to {snap.target} or the higher score at the buzzer
            </p>
          )}
          {[
            { side: 'A', team: teamA, score: scoreA, fouls: snap?.foulsA, timeouts: snap?.timeoutsA },
            { side: 'B', team: teamB, score: scoreB, fouls: snap?.foulsB, timeouts: snap?.timeoutsB },
          ].map(({ side, team, score, fouls, timeouts }) => {
            const penalty = fouls !== undefined ? foulPenalty(fouls) : null
            return (
              <div key={side} className="flex items-center justify-between mb-2 last:mb-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink truncate">{team?.name ?? 'TBD'}</span>
                    {snap && (
                      <span className="block text-xs text-ink-faint">
                        Team fouls {fouls}
                        {penalty && <span className="text-live font-semibold"> · opponents get {penalty.label}</span>}
                        {' · '}Timeouts {timeouts}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-4xl font-display font-bold text-accent w-16 text-right shrink-0">{score}</span>
              </div>
            )
          })}
          <div className="border-t border-line mt-3 pt-3 text-center">
            {isCompleted && <p className="text-sm text-ink-dim font-medium">Final</p>}
            {isForfeit && (
              <p className="text-sm text-live font-medium">
                Forfeit -- {match.forfeitTeamId === match.teamAId ? teamA?.name : teamB?.name}
              </p>
            )}
            {isLive && snap?.lastPlay && <p className="text-xs text-accent">Latest: {snap.lastPlay}</p>}
            {isLive && !snap && <p className="text-sm text-ink-faint">Waiting for the scorer's first update...</p>}
          </div>
        </div>

        {(isLive || isCompleted) && <ShareSection match={match} />}

        {/* On court now */}
        {isLive && snap && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { side: 'A', team: teamA, ids: snap.onCourtA },
              { side: 'B', team: teamB, ids: snap.onCourtB },
            ].map(({ side, team, ids }) => (
              <div key={side} className="rounded-xl border border-line bg-panel p-3">
                <p className="text-xs font-semibold text-ink-faint uppercase mb-2 truncate">{team?.name} on court</p>
                <div className="space-y-1">
                  {(ids ?? []).map((id) => {
                    const p = byId.get(id)
                    const s = snap.stats?.[id] ?? { points: 0, fouls: 0 }
                    return (
                      <div key={id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-dim truncate">
                          <span className="font-bold mr-1">#{p?.jerseyNumber ?? '--'}</span>
                          {p?.name ?? '?'}
                        </span>
                        <span className="text-xs text-ink-faint shrink-0 ml-2">{s.points} pts · {s.fouls} PF</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Final box score */}
        {isCompleted && boxScore && (
          <div className="space-y-4">
            {[{ team: teamA, id: match.teamAId }, { team: teamB, id: match.teamBId }].map(({ team, id }) => {
              const rows = boxScore.filter((b) => b.teamId === id).sort((a, b) => b.points - a.points)
              if (rows.length === 0) return null
              return (
                <div key={id} className="rounded-xl border border-line bg-panel overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-line font-medium text-ink truncate">{team?.name}</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint border-b border-line">
                        <th className="py-1.5 px-3">Player</th>
                        <th className="py-1.5 px-2 text-center">PTS</th>
                        <th className="py-1.5 px-2 text-center">Baskets</th>
                        <th className="py-1.5 px-2 text-center">PF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.playerId} className="border-b border-line last:border-0">
                          <td className="py-1.5 px-3 text-ink-dim truncate max-w-[160px]">{r.playerName}</td>
                          <td className="py-1.5 px-2 text-center font-medium text-ink">{r.points}</td>
                          <td className="py-1.5 px-2 text-center text-ink-dim">{r.fgMade}</td>
                          <td className="py-1.5 px-2 text-center text-ink-dim">{r.fouls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
        {isCompleted && !boxScore && <p className="text-center text-ink-faint text-sm py-6">Loading box score...</p>}
      </div>
    </div>
  )
}

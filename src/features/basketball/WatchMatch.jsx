import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, getMatchBoxScore } from '../../lib/matchesData'
import { getCloudMatchState } from '../../lib/liveMatchState'
import { supabase } from '../../lib/supabaseClient'

export default function WatchMatch() {
  const { tournamentId, matchId } = useParams()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [liveState, setLiveState] = useState(null)
  const [boxScore, setBoxScore] = useState(null)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const matchIdRef = useRef(matchId)
  matchIdRef.current = matchId

  async function refresh() {
    try {
      const [t, m] = await Promise.all([getTournament(tournamentId), getMatch(matchId)])
      setTournament(t)
      setMatch(m)

      if (m.status === 'live') {
        const snap = await getCloudMatchState(matchId)
        setLiveState(snap)
        setLastUpdated(new Date())
      } else if (m.status === 'completed') {
        const box = await getMatchBoxScore(matchId)
        setBoxScore(box)
      }
    } catch (err) {
      console.error('Failed to load match:', err)
      setError('Could not load this match. Check your connection and try refreshing.')
    }
  }

  // Load teams/rosters once (they don't change mid-game).
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

  // Initial load + polling fallback (covers the case where Realtime
  // isn't enabled on the Supabase project) every 8s while live.
  useEffect(() => {
    refresh()
    const interval = setInterval(() => {
      if (match?.status === 'live' || !match) refresh()
    }, 8000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, matchId, match?.status])

  // Realtime subscription -- near-instant updates when the scorer's
  // device pushes a new snapshot or the match completes, on top of the
  // polling fallback above.
  useEffect(() => {
    const channel = supabase
      .channel(`watch-match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_live_state', filter: `match_id=eq.${matchId}` },
        (payload) => {
          if (payload.new?.state) {
            setLiveState(payload.new.state)
            setLastUpdated(new Date())
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => {
          refresh()
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  function formatClock(totalSeconds) {
    if (totalSeconds == null) return '--:--'
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
    const s = String(totalSeconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  function quarterLabel(q) {
    if (q == null) return ''
    return q <= 4 ? `Q${q}` : `OT${q - 4}`
  }

  if (!tournament || !match) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <p className="text-slate-400">Loading...</p>
        )}
      </div>
    )
  }

  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
  const resolvePlayers = (ids) => (ids ?? []).map((id) => byId.get(id)).filter(Boolean)

  const isCompleted = match.status === 'completed'
  const isForfeit = match.status === 'forfeit'

  // Scores: from the final match record if completed, otherwise derived
  // live from the snapshot's playerStats.
  function liveScore(teamRosterIds) {
    if (!liveState?.playerStats) return 0
    return teamRosterIds.reduce((sum, id) => sum + (liveState.playerStats[id]?.points ?? 0), 0)
  }
  const allAIds = rosterA.map((p) => p.id)
  const allBIds = rosterB.map((p) => p.id)
  const scoreA = isCompleted || isForfeit ? match.teamAScore ?? 0 : liveScore(allAIds)
  const scoreB = isCompleted || isForfeit ? match.teamBScore ?? 0 : liveScore(allBIds)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={`/watch/${tournamentId}`} className="text-sm text-slate-400 hover:text-slate-600">
            ← {tournament.name}
          </Link>
          {match.status === 'live' && (
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Score header */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-slate-800">{teamA?.name ?? 'TBD'}</span>
            <span className="text-3xl font-bold text-slate-900">{scoreA}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-800">{teamB?.name ?? 'TBD'}</span>
            <span className="text-3xl font-bold text-slate-900">{scoreB}</span>
          </div>

          <div className="border-t border-slate-100 mt-3 pt-3 text-center">
            {isCompleted && <p className="text-sm text-slate-500 font-medium">Final</p>}
            {isForfeit && (
              <p className="text-sm text-red-500 font-medium">
                Forfeit -- {match.forfeitTeamId === match.teamAId ? teamA?.name : teamB?.name}
              </p>
            )}
            {match.status === 'live' && liveState && (
              <p className="text-sm text-slate-500 font-mono">
                {quarterLabel(liveState.quarter)} &middot; {formatClock(liveState.quarterSeconds)}
              </p>
            )}
            {match.status === 'live' && lastUpdated && (
              <p className="text-[11px] text-slate-300 mt-1">
                Updated {Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))}s ago
              </p>
            )}
          </div>
        </div>

        {/* Live box score (in-progress games) */}
        {match.status === 'live' && liveState?.playerStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TeamBox
              teamName={teamA?.name}
              lineup={resolvePlayers(liveState.lineupAIds)}
              stats={liveState.playerStats}
            />
            <TeamBox
              teamName={teamB?.name}
              lineup={resolvePlayers(liveState.lineupBIds)}
              stats={liveState.playerStats}
            />
          </div>
        )}

        {!liveState && match.status === 'live' && (
          <p className="text-center text-slate-400 text-sm py-6">
            Waiting for the scorer's first update...
          </p>
        )}

        {/* Full box score table (completed games) */}
        {isCompleted && boxScore && (
          <div className="space-y-4">
            <BoxScoreTable teamName={teamA?.name} teamId={match.teamAId} boxScore={boxScore} />
            <BoxScoreTable teamName={teamB?.name} teamId={match.teamBId} boxScore={boxScore} />
            {match.potgPlayerId && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-center">
                <p className="text-xs text-orange-600 font-medium uppercase mb-0.5">Player of the Game</p>
                <p className="text-sm font-semibold text-orange-800">
                  {boxScore.find((b) => b.playerId === match.potgPlayerId)?.playerName ?? 'Unknown'}
                </p>
              </div>
            )}
          </div>
        )}

        {isCompleted && !boxScore && (
          <p className="text-center text-slate-400 text-sm py-6">No box score was recorded for this game.</p>
        )}
      </div>
    </div>
  )
}

function BoxScoreTable({ teamName, teamId, boxScore }) {
  const rows = boxScore.filter((b) => b.teamId === teamId)
  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 overflow-x-auto">
      <p className="text-xs font-semibold text-slate-400 uppercase mb-2 truncate">{teamName}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-100">
            <th className="py-1.5 pr-2">Player</th>
            <th className="py-1.5 px-1.5 text-center">PTS</th>
            <th className="py-1.5 px-1.5 text-center">REB</th>
            <th className="py-1.5 px-1.5 text-center">AST</th>
            <th className="py-1.5 px-1.5 text-center">STL</th>
            <th className="py-1.5 px-1.5 text-center">BLK</th>
            <th className="py-1.5 px-1.5 text-center">TO</th>
            <th className="py-1.5 px-1.5 text-center">FG</th>
            <th className="py-1.5 px-1.5 text-center">PF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId} className="border-b border-slate-50">
              <td className="py-1.5 pr-2 text-slate-700 truncate max-w-[120px]">{r.playerName}</td>
              <td className="py-1.5 px-1.5 text-center font-medium text-slate-800">{r.points}</td>
              <td className="py-1.5 px-1.5 text-center text-slate-500">{r.rebounds}</td>
              <td className="py-1.5 px-1.5 text-center text-slate-500">{r.assists}</td>
              <td className="py-1.5 px-1.5 text-center text-slate-500">{r.steals}</td>
              <td className="py-1.5 px-1.5 text-center text-slate-500">{r.blocks}</td>
              <td className="py-1.5 px-1.5 text-center text-slate-500">{r.turnovers}</td>
              <td className="py-1.5 px-1.5 text-center text-slate-500">{r.fgMade}/{r.fgAttempted}</td>
              <td className="py-1.5 px-1.5 text-center text-slate-500">
                {r.fouls}{r.technicalFouls > 0 && <span className="text-red-500"> +{r.technicalFouls}T</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamBox({ teamName, lineup, stats }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-400 uppercase mb-2 truncate">{teamName}</p>
      <div className="space-y-1">
        {lineup.map((player) => {
          const s = stats[player.id] ?? { points: 0, fouls: 0, assists: 0, turnovers: 0 }
          return (
            <div key={player.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 truncate">
                <span className="font-bold text-slate-500 mr-1">#{player.jerseyNumber ?? '--'}</span>
                {player.name}
              </span>
              <span className="text-xs text-slate-400 shrink-0 ml-2">
                {s.points}p &middot; {s.assists}a &middot; {s.fouls}f
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

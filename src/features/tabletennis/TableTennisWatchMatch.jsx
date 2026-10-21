import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch } from '../../lib/matchesData'
import { getCloudMatchState } from '../../lib/liveMatchState'
import { supabase } from '../../lib/supabaseClient'
import { getMatchSets } from '../../lib/volleyballData'
import { whoIsWho } from '../../lib/tableTennisRules'
import { TEAM_CLASS } from '../../lib/teamColors'
import ShareSection from '../watch/ShareSection'
import TableTennisCourt from './TableTennisCourt'

/**
 * Public live/final view of a table tennis match: games won, the score of the
 * current game, game-by-game results and the live court showing who serves
 * from where. While live, the scorer's device sends snapshots (see
 * TableTennisMatchSimulate); once completed everything is read from match_sets.
 */
export default function TableTennisWatchMatch() {
  const { tournamentId, matchId } = useParams()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [liveState, setLiveState] = useState(null)
  const [savedSets, setSavedSets] = useState([])
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const statusRef = useRef(null)

  async function refresh() {
    try {
      const [t, m] = await Promise.all([getTournament(tournamentId), getMatch(matchId)])
      setTournament(t)
      setMatch(m)
      statusRef.current = m.status
      if (m.status === 'live') {
        const snap = await getCloudMatchState(matchId)
        setLiveState(snap)
        setLastUpdated(new Date())
      } else if (m.status === 'completed') {
        setSavedSets(await getMatchSets(matchId))
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

  // First load, then poll while live (covers projects without Realtime).
  useEffect(() => {
    refresh()
    const interval = setInterval(() => {
      if (statusRef.current === null || statusRef.current === 'live') refresh()
    }, 8000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, matchId])

  // Near-instant updates when the scorer's device sends a snapshot or the match finishes.
  useEffect(() => {
    const channel = supabase
      .channel(`watch-tabletennis-${matchId}`)
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

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

  const gamesA = snap ? snap.gamesWonA : match.teamAScore ?? 0
  const gamesB = snap ? snap.gamesWonB : match.teamBScore ?? 0

  const finished = snap
    ? (snap.history ?? []).map((g) => ({ n: g.gameNumber, a: g.scoreA, b: g.scoreB }))
    : savedSets.map((s) => ({ n: s.setNumber, a: s.teamAScore, b: s.teamBScore }))
  const current = snap && !snap.gameOver ? { n: snap.currentGame, a: snap.scoreA, b: snap.scoreB } : null
  const rows = [...finished, ...(current ? [current] : [])]

  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
  const playersA = (snap?.idsA ?? []).map((id) => byId.get(id)).filter(Boolean)
  const playersB = (snap?.idsB ?? []).map((id) => byId.get(id)).filter(Boolean)
  const perSide = snap?.matchType === 'doubles' ? 2 : 1
  const gs = snap && snap.order ? { scoreA: snap.scoreA, scoreB: snap.scoreB, order: snap.order } : null
  const who = gs && playersA.length >= perSide && playersB.length >= perSide ? whoIsWho(gs) : null
  const server = who ? (who.server.side === 'A' ? playersA : playersB)[who.server.idx] : null

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

        {/* Score header */}
        <div className="rounded-xl border border-line bg-panel p-5 mb-4">
          {[
            { side: 'A', team: teamA, games: gamesA, now: current?.a, players: playersA },
            { side: 'B', team: teamB, games: gamesB, now: current?.b, players: playersB },
          ].map(({ side, team, games, now, players }) => (
            <div key={side} className="flex items-center justify-between mb-2 last:mb-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
                <span className="min-w-0">
                  <span className="block font-medium text-ink truncate">{team?.name ?? 'TBD'}</span>
                  {players.length > 0 && (
                    <span className="block text-xs text-ink-faint truncate">{players.map((p) => p.name).join(' / ')}</span>
                  )}
                </span>
              </span>
              <span className="flex items-baseline gap-3 shrink-0">
                {now !== undefined && <span className="text-3xl font-display font-bold text-ink">{now}</span>}
                <span className="text-xl font-display font-bold text-accent w-6 text-right">{games}</span>
              </span>
            </div>
          ))}

          <div className="border-t border-line mt-3 pt-3 text-center">
            {isCompleted && <p className="text-sm text-ink-dim font-medium">Final</p>}
            {isCompleted && match.potgPlayerId && (() => {
              const mvp = [...rosterA, ...rosterB].find((p) => p.id === match.potgPlayerId)
              return mvp ? (
                <p className="text-xs text-ink-dim mt-1">
                  MVP: <span className="font-semibold text-accent">{mvp.name}</span>
                </p>
              ) : null
            })()}
            {isForfeit && (
              <p className="text-sm text-live font-medium">
                Forfeit -- {match.forfeitTeamId === match.teamAId ? teamA?.name : teamB?.name}
              </p>
            )}
            {isLive && snap && (
              <p className="text-sm text-ink-dim font-display">
                Game {snap.currentGame} &middot; first to {snap.target} (win by 2)
                {snap.gameOver ? ' · game finished' : ''}
              </p>
            )}
            {isLive && server && !snap.gameOver && (
              <p className="text-xs text-ink-dim mt-1">
                Serving: <span className="font-medium text-ink">{server.name}</span>
              </p>
            )}
            {isLive && lastUpdated && (
              <p className="text-[11px] text-ink-faint mt-1">
                Updated {Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))}s ago
              </p>
            )}
            {isLive && !snap && <p className="text-sm text-ink-faint">Waiting for the scorer's first update...</p>}
          </div>
        </div>

        {(isLive || isCompleted) && <ShareSection match={match} />}

        {/* Game by game */}
        {rows.length > 0 && (
          <div className="rounded-xl border border-line bg-panel p-3 mb-4 overflow-x-auto">
            <p className="text-xs font-semibold text-ink-faint uppercase mb-2">Game by game</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-faint border-b border-line text-xs">
                  <th className="py-1.5 pr-2">Team</th>
                  {rows.map((g) => (
                    <th key={g.n} className="py-1.5 px-2 text-center">G{g.n}</th>
                  ))}
                  <th className="py-1.5 pl-2 text-center">Games</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { side: 'A', team: teamA, key: 'a', games: gamesA },
                  { side: 'B', team: teamB, key: 'b', games: gamesB },
                ].map(({ side, team, key, games }) => (
                  <tr key={side} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-2 text-ink truncate max-w-[140px]">{team?.name ?? 'TBD'}</td>
                    {rows.map((g) => {
                      const other = key === 'a' ? g.b : g.a
                      const inProgress = current && g.n === current.n
                      return (
                        <td
                          key={g.n}
                          className={`py-1.5 px-2 text-center ${inProgress ? 'text-live' : g[key] > other ? 'font-semibold text-ink' : 'text-ink-dim'}`}
                        >
                          {g[key]}
                        </td>
                      )
                    })}
                    <td className="py-1.5 pl-2 text-center font-bold text-accent">{games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Live court */}
        {isLive && snap && playersA.length > 0 && playersB.length > 0 && (
          <div className="rounded-xl border border-line bg-panel p-3 mb-4">
            <p className="text-xs font-semibold text-ink-faint uppercase mb-2">On court</p>
            <div className="relative w-full mx-auto" style={{ aspectRatio: '300 / 170', maxWidth: 640 }}>
              <TableTennisCourt state={gs} playersA={playersA} playersB={playersB} flipped={!!snap.flipped} perSide={perSide} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

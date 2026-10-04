import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch } from '../../lib/matchesData'
import { getCloudMatchState } from '../../lib/liveMatchState'
import { supabase } from '../../lib/supabaseClient'
import {
  getMatchSets,
  getVolleyballEvents,
  summarizeEvents,
  hittingPercentage,
  formatHitting,
  VOLLEYBALL_ACTIONS,
} from '../../lib/volleyballData'
import { TEAM_CLASS } from '../../lib/teamColors'
import ShareSection from '../watch/ShareSection'
import VolleyballCourt from './VolleyballCourt'

/**
 * Public live/final view of a volleyball match: sets won, the score of the
 * current set, set-by-set results, the live court with rotation, and a box
 * score. While the match is live the scorer's device sends snapshots (see
 * VolleyballMatchSimulate); once it is completed everything is read from
 * match_sets and volleyball_events.
 */
export default function VolleyballWatchMatch() {
  const { tournamentId, matchId } = useParams()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [liveState, setLiveState] = useState(null)
  const [savedSets, setSavedSets] = useState([])
  const [savedEvents, setSavedEvents] = useState([])
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
        const [sets, events] = await Promise.all([getMatchSets(matchId), getVolleyballEvents(matchId)])
        setSavedSets(sets)
        setSavedEvents(events)
      }
    } catch (err) {
      console.error('Failed to load match:', err)
      setError('Could not load this match. Check your connection and try refreshing.')
    }
  }

  // Teams and rosters don't change mid-match, so load them once.
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

  // Near-instant updates when the scorer's device sends a snapshot or the
  // match finishes.
  useEffect(() => {
    const channel = supabase
      .channel(`watch-volleyball-${matchId}`)
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
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  if (!tournament || !match) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
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

  // Sets won: from the live snapshot while playing, from the match row after.
  const setsA = snap ? snap.setsWonA : match.teamAScore ?? 0
  const setsB = snap ? snap.setsWonB : match.teamBScore ?? 0

  // Finished sets, then the set in progress (if any).
  const finishedSets = snap
    ? (snap.setHistory ?? []).map((s) => ({ setNumber: s.setNumber, a: s.scoreA, b: s.scoreB }))
    : savedSets.map((s) => ({ setNumber: s.setNumber, a: s.teamAScore, b: s.teamBScore }))
  const currentSet = snap && !snap.setOver ? { setNumber: snap.currentSet, a: snap.scoreA, b: snap.scoreB } : null

  const events = snap ? snap.events ?? [] : savedEvents
  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
  const lastEvent = events.length > 0 ? events[events.length - 1] : null
  const lastLabel = lastEvent
    ? `${byId.get(lastEvent.playerId)?.name ?? 'Player'} ${(VOLLEYBALL_ACTIONS.find((a) => a.key === lastEvent.action)?.label ?? lastEvent.action).toLowerCase()}`
    : null

  const servingSide = snap?.servingTeam ?? null
  const serverId = snap && servingSide ? (servingSide === 'A' ? snap.rotationA : snap.rotationB)?.[0] : null
  const server = serverId ? byId.get(serverId) : null

  return (
    <div className="min-h-screen bg-page">
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
            { side: 'A', team: teamA, sets: setsA, now: currentSet?.a },
            { side: 'B', team: teamB, sets: setsB, now: currentSet?.b },
          ].map(({ side, team, sets, now }) => (
            <div key={side} className="flex items-center justify-between mb-1 last:mb-0">
              <span className="flex items-center gap-2 font-medium text-ink min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
                <span className="truncate">{team?.name ?? 'TBD'}</span>
              </span>
              <span className="flex items-baseline gap-3">
                {now !== undefined && <span className="text-lg font-display text-ink-dim">{now}</span>}
                <span className="text-3xl font-display font-bold text-accent w-8 text-right">{sets}</span>
              </span>
            </div>
          ))}

          <div className="border-t border-line mt-3 pt-3 text-center">
            {isCompleted && <p className="text-sm text-ink-dim font-medium">Final</p>}
            {isForfeit && (
              <p className="text-sm text-live font-medium">
                Forfeit -- {match.forfeitTeamId === match.teamAId ? teamA?.name : teamB?.name}
              </p>
            )}
            {isLive && snap && (
              <p className="text-sm text-ink-dim font-display">
                Set {snap.currentSet} &middot; first to {snap.target}
                {snap.setOver ? ' · set finished' : ''}
              </p>
            )}
            {isLive && server && (
              <p className="text-xs text-ink-dim mt-1">
                Serving: <span className="font-medium text-ink">{server.name}</span>
                {server.jerseyNumber ? ` #${server.jerseyNumber}` : ''} ({servingSide === 'A' ? teamA?.name : teamB?.name})
              </p>
            )}
            {isLive && lastLabel && <p className="text-xs text-accent mt-1">Latest: {lastLabel}</p>}
            {isLive && lastUpdated && (
              <p className="text-[11px] text-ink-faint mt-1">
                Updated {Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))}s ago
              </p>
            )}
            {isLive && !snap && (
              <p className="text-sm text-ink-faint">Waiting for the scorer's first update...</p>
            )}
          </div>
        </div>

        {(isLive || isCompleted) && <ShareSection match={match} />}

        {/* Set by set */}
        {(finishedSets.length > 0 || currentSet) && (
          <div className="rounded-xl border border-line bg-panel p-3 mb-4 overflow-x-auto">
            <p className="text-xs font-semibold text-ink-faint uppercase mb-2">Set by set</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-faint border-b border-line text-xs">
                  <th className="py-1.5 pr-2">Team</th>
                  {[...finishedSets, ...(currentSet ? [currentSet] : [])].map((s) => (
                    <th key={s.setNumber} className="py-1.5 px-2 text-center">
                      S{s.setNumber}
                    </th>
                  ))}
                  <th className="py-1.5 pl-2 text-center">Sets</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { side: 'A', team: teamA, key: 'a', sets: setsA },
                  { side: 'B', team: teamB, key: 'b', sets: setsB },
                ].map(({ side, team, key, sets }) => (
                  <tr key={side} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-2 text-ink truncate max-w-[140px]">{team?.name ?? 'TBD'}</td>
                    {[...finishedSets, ...(currentSet ? [currentSet] : [])].map((s) => {
                      const other = key === 'a' ? s.b : s.a
                      const won = s[key] > other
                      const inProgress = currentSet && s.setNumber === currentSet.setNumber
                      return (
                        <td
                          key={s.setNumber}
                          className={`py-1.5 px-2 text-center ${
                            inProgress ? 'text-live' : won ? 'font-semibold text-ink' : 'text-ink-dim'
                          }`}
                        >
                          {s[key]}
                        </td>
                      )
                    })}
                    <td className="py-1.5 pl-2 text-center font-bold text-accent">{sets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Live court */}
        {isLive && snap && snap.rotationA?.length > 0 && (
          <div className="rounded-xl border border-line bg-panel p-3 mb-4">
            <p className="text-xs font-semibold text-ink-faint uppercase mb-2">On court</p>
            <div className="relative w-full mx-auto" style={{ aspectRatio: '22 / 13', maxWidth: 640 }}>
              <VolleyballCourt
                portrait={false}
                rotationA={snap.rotationA}
                rotationB={snap.rotationB}
                rosterA={rosterA}
                rosterB={rosterB}
                servingTeam={snap.servingTeam}
                liberoA={snap.liberoA}
                liberoB={snap.liberoB}
                locked
                tallies={summarizeEvents((snap.events ?? []).filter((e) => e.setNumber === snap.currentSet))}
              />
            </div>
          </div>
        )}

        {/* Box score */}
        {(isLive || isCompleted) && events.length > 0 && (
          <div className="space-y-4">
            <WatchBoxScore
              side="A"
              team={teamA}
              roster={rosterA}
              events={events}
              playedIds={snap?.playedA}
              liberoId={snap?.liberoA}
              showAll={isCompleted}
            />
            <WatchBoxScore
              side="B"
              team={teamB}
              roster={rosterB}
              events={events}
              playedIds={snap?.playedB}
              liberoId={snap?.liberoB}
              showAll={isCompleted}
            />
          </div>
        )}

        {isCompleted && events.length === 0 && (
          <p className="text-center text-ink-faint text-sm py-6">No player stats were recorded for this match.</p>
        )}
      </div>
    </div>
  )
}

function WatchBoxScore({ side, team, roster, events, playedIds, liberoId, showAll }) {
  const stats = summarizeEvents(events.filter((e) => e.teamId === team?.id))
  // While live, show players who have been on court. Once the match is over we
  // no longer know who played, so list the whole roster (stat leaders first).
  const rows = roster
    .filter((p) => showAll || stats.has(p.id) || (playedIds ?? []).includes(p.id))
    .sort((a, b) => (stats.get(b.id)?.kills ?? 0) - (stats.get(a.id)?.kills ?? 0))
  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
        <span className="font-medium text-ink truncate">{team?.name ?? 'TBD'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-faint border-b border-line">
              <th className="py-1.5 px-3">Player</th>
              {['K', 'E', 'TA', 'Hit%', 'Ace', 'SE', 'Blk', 'Dig', 'Ast'].map((h) => (
                <th key={h} className="py-1.5 px-1.5 text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const s = stats.get(p.id) ?? {
                kills: 0, attackErrors: 0, attackAttempts: 0, aces: 0, serviceErrors: 0, blocks: 0, digs: 0, assists: 0,
              }
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="py-1.5 px-3 text-ink-dim truncate max-w-[140px]">
                    {p.jerseyNumber ? <span className="text-ink-faint">#{p.jerseyNumber} </span> : null}
                    {p.name}
                    {p.id === liberoId && <span className="ml-1 text-[9px] font-semibold text-accent">L</span>}
                  </td>
                  <td className="py-1.5 px-1.5 text-center font-medium text-ink">{s.kills}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{s.attackErrors}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{s.attackAttempts}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{formatHitting(hittingPercentage(s))}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{s.aces}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{s.serviceErrors}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{s.blocks}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{s.digs}</td>
                  <td className="py-1.5 px-1.5 text-center text-ink-dim">{s.assists}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

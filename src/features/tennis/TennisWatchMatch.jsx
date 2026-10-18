import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch } from '../../lib/matchesData'
import { getCloudMatchState } from '../../lib/liveMatchState'
import { supabase } from '../../lib/supabaseClient'
import { getMatchSets } from '../../lib/volleyballData'
import { currentServer, serveCourt, serverIdx, pointLabels } from '../../lib/tennisRules'
import { TEAM_CLASS } from '../../lib/teamColors'
import ShareSection from '../watch/ShareSection'
import TennisCourt from './TennisCourt'

/**
 * Public live/final view of a tennis match: games won, the score of the
 * current game, set-by-set results and the live court showing who serves
 * from where. While live, the scorer's device sends snapshots (see
 * TennisMatchSimulate); once completed everything is read from match_sets.
 */
export default function TennisWatchMatch() {
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
      .channel(`watch-tennis-${matchId}`)
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

  const live = snap?.match ?? null
  const setsA = live ? live.winsA : match.teamAScore ?? 0
  const setsB = live ? live.winsB : match.teamBScore ?? 0
  const noAd = !!snap?.noAd
  const labels = live ? pointLabels(live, noAd) : null

  // Finished sets: from the live snapshot, or from the saved results once the match is over.
  const finished = live
    ? live.sets.map((s, i) => ({ n: i + 1, a: s.a, b: s.b, tb: s.tb }))
    : savedSets.map((s) => ({ n: s.setNumber, a: s.teamAScore, b: s.teamBScore, tb: null }))
  const inPlay = live && !live.over && live.mode !== 'matchtb' ? { n: live.sets.length + 1, a: live.gA, b: live.gB } : null
  const rows = [...finished, ...(inPlay ? [inPlay] : [])]
  
  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
  const playersA = (snap?.idsA ?? []).map((id) => byId.get(id)).filter(Boolean)
  const playersB = (snap?.idsB ?? []).map((id) => byId.get(id)).filter(Boolean)
  const perSide = snap?.matchType === 'doubles' ? 2 : 1
  const serverSide = live ? currentServer(live) : null
  const server = live && playersA.length >= perSide && playersB.length >= perSide
    ? (serverSide === 'A' ? playersA : playersB)[serverIdx(live, perSide)]
    : null
  const court = live ? serveCourt(live) : null
  const tbLabel = live && live.mode !== 'game' ? (live.mode === 'matchtb' ? 'Match tiebreak' : 'Tiebreak') : ''

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
            { side: 'A', team: teamA, sets: setsA, now: labels?.A, games: live?.gA, players: playersA },
            { side: 'B', team: teamB, sets: setsB, now: labels?.B, games: live?.gB, players: playersB },
          ].map(({ side, team, sets, now, games, players }) => (
            <div key={side} className="flex items-center justify-between mb-2 last:mb-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
                <span className="min-w-0">
                  <span className="block font-medium text-ink truncate">
                    {team?.name ?? 'TBD'}
                    {isLive && serverSide === side && <span className="ml-1 text-[10px] text-accent">● serving</span>}
                  </span>
                  {players.length > 0 && (
                    <span className="block text-xs text-ink-faint truncate">{players.map((p) => p.name).join(' / ')}</span>
                  )}
                </span>
              </span>
              <span className="flex items-baseline gap-3 shrink-0">
                {isLive && live && !live.over && <span className="text-3xl font-display font-bold text-ink w-12 text-right">{now}</span>}
                {isLive && live && !live.over && live.mode !== 'matchtb' && <span className="text-lg font-display text-ink-dim w-5 text-right">{games}</span>}
                <span className="text-xl font-display font-bold text-accent w-6 text-right">{sets}</span>
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
            {isLive && live && (
              <p className="text-sm text-ink-dim font-display">
                Set {live.sets.length + 1} &middot; {snap.setsToWin === 1 ? 'one set' : `best of ${snap.setsToWin * 2 - 1}`}
                {tbLabel ? ` · ${tbLabel}` : ''}
              </p>
            )}
            {isLive && server && !live.over && (
              <p className="text-xs text-ink-dim mt-1">
                Serving: <span className="font-medium text-ink">{server.name}</span> from the {court === 'right' ? 'right (deuce)' : 'left (ad)'} court
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

        {/* Set by set */}
        {rows.length > 0 && (
          <div className="rounded-xl border border-line bg-panel p-3 mb-4 overflow-x-auto">
            <p className="text-xs font-semibold text-ink-faint uppercase mb-2">Set by set</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-faint border-b border-line text-xs">
                  <th className="py-1.5 pr-2">Team</th>
                  {rows.map((g) => (
                    <th key={g.n} className="py-1.5 px-2 text-center">S{g.n}</th>
                  ))}
                  <th className="py-1.5 pl-2 text-center">Sets</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { side: 'A', team: teamA, key: 'a', games: setsA },
                  { side: 'B', team: teamB, key: 'b', games: setsB },
                ].map(({ side, team, key, games }) => (
                  <tr key={side} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-2 text-ink truncate max-w-[140px]">{team?.name ?? 'TBD'}</td>
                    {rows.map((g) => {
                      const other = key === 'a' ? g.b : g.a
                      const inProgress = inPlay && g.n === inPlay.n
                      return (
                        <td
                          key={g.n}
                          className={`py-1.5 px-2 text-center ${inProgress ? 'text-live' : g[key] > other ? 'font-semibold text-ink' : 'text-ink-dim'}`}
                        >
                          {g[key]}{g.tb && g[key] < other ? <sup className="text-[9px]">{g.tb[key]}</sup> : null}
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
        {isLive && live && playersA.length > 0 && playersB.length > 0 && (
          <div className="rounded-xl border border-line bg-panel p-3 mb-4">
            <p className="text-xs font-semibold text-ink-faint uppercase mb-2">On court</p>
            <div className="relative w-full mx-auto" style={{ aspectRatio: '88 / 46', maxWidth: 640 }}>
              <TennisCourt portrait={false} match={live} playersA={playersA} playersB={playersB} flipped={!!snap.flipped} matchType={snap.matchType} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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

  // Most recent non-reversed, actually-newsworthy event (skip subs/
  // corrections for this ticker -- just the "Juan +3" style highlights).
  function latestEvent() {
    const log = liveState?.actionLog
    if (!log || log.length === 0) return null
    const NEWSWORTHY = ['POINT', 'FOUL', 'TECHNICAL', 'ASSIST', 'STEAL', 'BLOCK', 'REBOUND', 'TURNOVER']
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (!e.reversed && NEWSWORTHY.includes(e.type)) return e
    }
    return null
  }

  const EVENT_LABEL = { POINT: '+', FOUL: 'foul', TECHNICAL: 'technical foul', ASSIST: 'assist', STEAL: 'steal', BLOCK: 'block', REBOUND: 'rebound', TURNOVER: 'turnover' }

  function formatLatestEvent(e) {
    const player = [...rosterA, ...rosterB].find((p) => p.id === e.playerId)
    const name = player ? player.name : 'Unknown'
    if (e.type === 'POINT') return `${name} +${e.amount}`
    return `${name} ${EVENT_LABEL[e.type] ?? e.type.toLowerCase()}`
  }

  if (!tournament || !match) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        ) : (
          <p className="text-ink-faint">Loading...</p>
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
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-panel">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={`/watch/${tournamentId}`} className="text-sm text-ink-faint hover:text-ink-dim">
            ← {tournament.name}
          </Link>
          {match.status === 'live' && (
            <span className="text-xs font-medium text-live flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        )}

        {/* Score header */}
        <div className="rounded-xl border border-line bg-panel p-5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-ink">{teamA?.name ?? 'TBD'}</span>
            <span className="text-3xl font-display font-bold text-accent">{scoreA}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink">{teamB?.name ?? 'TBD'}</span>
            <span className="text-3xl font-display font-bold text-accent">{scoreB}</span>
          </div>

          <div className="border-t border-line mt-3 pt-3 text-center">
            {isCompleted && <p className="text-sm text-ink-dim font-medium">Final</p>}
            {isForfeit && (
              <p className="text-sm text-live font-medium">
                Forfeit -- {match.forfeitTeamId === match.teamAId ? teamA?.name : teamB?.name}
              </p>
            )}
            {match.status === 'live' && liveState && (
              <p className="text-sm text-ink-dim font-display">
                {quarterLabel(liveState.quarter)} &middot; {formatClock(liveState.quarterSeconds)}
              </p>
            )}
            {match.status === 'live' && latestEvent() && (
              <p className="text-xs text-accent mt-1">Latest: {formatLatestEvent(latestEvent())}</p>
            )}
            {match.status === 'live' && lastUpdated && (
              <p className="text-[11px] text-ink-faint mt-1">
                Updated {Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))}s ago
              </p>
            )}
          </div>
        </div>

        {/* Share this live game */}
        {(match.status === 'live' || isCompleted) && <ShareSection match={match} />}

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
          <p className="text-center text-ink-faint text-sm py-6">
            Waiting for the scorer's first update...
          </p>
        )}

        {/* Full box score table (completed games) */}
        {isCompleted && boxScore && (
          <div className="space-y-4">
            <BoxScoreTable teamName={teamA?.name} teamId={match.teamAId} boxScore={boxScore} />
            <BoxScoreTable teamName={teamB?.name} teamId={match.teamBId} boxScore={boxScore} />
            {match.potgPlayerId && (
              <div className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-center">
                <p className="text-xs text-accent font-medium uppercase mb-0.5">Player of the Game</p>
                <p className="text-sm font-semibold text-accent">
                  {boxScore.find((b) => b.playerId === match.potgPlayerId)?.playerName ?? 'Unknown'}
                </p>
              </div>
            )}
          </div>
        )}

        {isCompleted && !boxScore && (
          <p className="text-center text-ink-faint text-sm py-6">No box score was recorded for this game.</p>
        )}
      </div>
    </div>
  )
}

function ShareSection({ match }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const shareUrl = match.shareCode
    ? `${window.location.origin}/live/${match.shareCode}`
    : window.location.href

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail on some browsers/contexts -- not critical, user can select the text manually.
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Live game', url: shareUrl })
      } catch {
        // User cancelled the share sheet -- nothing to do.
      }
    } else {
      setExpanded(true)
    }
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`
  const messengerUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=0&redirect_uri=${encodeURIComponent(shareUrl)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`

  return (
    <div className="rounded-xl border border-line bg-panel p-4 mb-4">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-sm font-medium text-ink"
      >
        <span>📤 Share this live game</span>
        <span className="text-ink-faint text-xs">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col sm:flex-row gap-4 items-center">
          <img src={qrSrc} alt="QR code to this live game" width={140} height={140} className="rounded-lg border border-line shrink-0" />
          <div className="flex-1 w-full space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                onClick={(e) => e.target.select()}
                className="flex-1 min-w-0 rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-xs text-ink-dim"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-xs font-medium px-3 py-2 transition"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs font-medium py-2 transition"
              >
                Share...
              </button>
              <a
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs font-medium py-2 transition"
              >
                Messenger
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs font-medium py-2 transition"
              >
                Facebook
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BoxScoreTable({ teamName, teamId, boxScore }) {
  const rows = boxScore.filter((b) => b.teamId === teamId)
  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-line bg-panel p-3 overflow-x-auto">
      <p className="text-xs font-semibold text-ink-faint uppercase mb-2 truncate">{teamName}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ink-faint border-b border-line">
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
            <tr key={r.playerId} className="border-b border-line">
              <td className="py-1.5 pr-2 text-ink-dim truncate max-w-[120px]">{r.playerName}</td>
              <td className="py-1.5 px-1.5 text-center font-medium text-ink">{r.points}</td>
              <td className="py-1.5 px-1.5 text-center text-ink-dim">{r.rebounds}</td>
              <td className="py-1.5 px-1.5 text-center text-ink-dim">{r.assists}</td>
              <td className="py-1.5 px-1.5 text-center text-ink-dim">{r.steals}</td>
              <td className="py-1.5 px-1.5 text-center text-ink-dim">{r.blocks}</td>
              <td className="py-1.5 px-1.5 text-center text-ink-dim">{r.turnovers}</td>
              <td className="py-1.5 px-1.5 text-center text-ink-dim">{r.fgMade}/{r.fgAttempted}</td>
              <td className="py-1.5 px-1.5 text-center text-ink-dim">
                {r.fouls}{r.technicalFouls > 0 && <span className="text-live"> +{r.technicalFouls}T</span>}
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
    <div className="rounded-xl border border-line bg-panel p-3">
      <p className="text-xs font-semibold text-ink-faint uppercase mb-2 truncate">{teamName}</p>
      <div className="space-y-1">
        {lineup.map((player) => {
          const s = stats[player.id] ?? { points: 0, fouls: 0, assists: 0, turnovers: 0 }
          return (
            <div key={player.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-dim truncate">
                <span className="font-bold text-ink-dim mr-1">#{player.jerseyNumber ?? '--'}</span>
                {player.name}
              </span>
              <span className="text-xs text-ink-faint shrink-0 ml-2">
                {s.points}p &middot; {s.assists}a &middot; {s.fouls}f
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

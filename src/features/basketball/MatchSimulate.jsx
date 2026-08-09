import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, completeMatch, saveActionLog } from '../../lib/matchesData'
import {
  saveLocalMatchState,
  getLocalMatchState,
  pushCloudMatchState,
  getCloudMatchState,
  clearMatchState,
} from '../../lib/liveMatchState'

// Real JS-based check instead of Tailwind's hidden/md:block classes --
// guarantees only ONE layout is ever in the DOM at a time, no matter
// what happens with CSS class generation.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

const emptyStats = () => ({
  points: 0, fouls: 0, turnovers: 0, assists: 0,
  rebounds: 0, steals: 0, blocks: 0, technicalFouls: 0,
  fgMade: 0, fgAttempted: 0,
  byQuarter: {}, foulsByQuarter: {},
})

export default function MatchSimulate() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [error, setError] = useState('')

  const [lineupA, setLineupA] = useState([])
  const [benchA, setBenchA] = useState([])
  const [lineupB, setLineupB] = useState([])
  const [benchB, setBenchB] = useState([])

  const [playerStats, setPlayerStats] = useState({})
  const [selectedA, setSelectedA] = useState(null)
  const [selectedB, setSelectedB] = useState(null)

  // Append-only log of every scoring action taken. Nothing is ever
  // edited or removed from here -- a "correction" just adds a new
  // reversal entry pointing back at the original, so there's always a
  // full, honest trail of what actually happened, including mistakes.
  const [actionLog, setActionLog] = useState([])
  const [showLogModal, setShowLogModal] = useState(false)

  const [quarter, setQuarter] = useState(1) // 1-4, then 5+ = OT1, OT2, ...
  const [quarterSeconds, setQuarterSeconds] = useState(null)
  const [running, setRunning] = useState(false)
  const [shotClock, setShotClock] = useState(24)
  const [timeoutsA, setTimeoutsA] = useState(null)
  const [timeoutsB, setTimeoutsB] = useState(null)
  const [possession, setPossession] = useState('left')

  // Rest/break countdown -- shown whenever a timeout is called OR a
  // quarter ends, separate from the main game clock.
  const [restSeconds, setRestSeconds] = useState(null)

  const [saving, setSaving] = useState(false)
  const [resumedFromSnapshot, setResumedFromSnapshot] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const [t, m, teams] = await Promise.all([
          getTournament(tournamentId),
          getMatch(matchId),
          getTeamsForTournament(tournamentId),
        ])
        setTournament(t)
        setMatch(m)
        setQuarterSeconds((t.rules?.quarterMinutes ?? 10) * 60)
        setTimeoutsA(t.rules?.timeoutsPerTeam ?? 4)
        setTimeoutsB(t.rules?.timeoutsPerTeam ?? 4)

        const tA = teams.find((tm) => tm.id === m.teamAId) ?? null
        const tB = teams.find((tm) => tm.id === m.teamBId) ?? null
        setTeamA(tA)
        setTeamB(tB)

        const [rosterA, rosterB] = await Promise.all([
          tA ? getRosterForTeam(tA.id) : Promise.resolve([]),
          tB ? getRosterForTeam(tB.id) : Promise.resolve([]),
        ])

        const saved = sessionStorage.getItem(`lineup:${matchId}`)
        let startersA = rosterA.slice(0, 5)
        let startersB = rosterB.slice(0, 5)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            const aIds = new Set(parsed.teamAStarters ?? [])
            const bIds = new Set(parsed.teamBStarters ?? [])
            if (aIds.size > 0) startersA = rosterA.filter((p) => aIds.has(p.id))
            if (bIds.size > 0) startersB = rosterB.filter((p) => bIds.has(p.id))
          } catch {
            // Malformed saved lineup -- just use the roster-order fallback above.
          }
        }
        setLineupA(startersA)
        setBenchA(rosterA.filter((p) => !startersA.some((s) => s.id === p.id)))
        setLineupB(startersB)
        setBenchB(rosterB.filter((p) => !startersB.some((s) => s.id === p.id)))

        const stats = {}
        ;[...rosterA, ...rosterB].forEach((p) => {
          stats[p.id] = emptyStats()
        })
        setPlayerStats(stats)

        // Resume in progress if a snapshot exists -- local device first,
        // cloud as a fallback. This is what protects a live game from
        // being lost to a refresh, crash, or dropped connection.
        const snapshot = (await getLocalMatchState(matchId)) ?? (await getCloudMatchState(matchId))
        if (snapshot) {
          const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
          const resolve = (ids) => (ids ?? []).map((id) => byId.get(id)).filter(Boolean)

          if (snapshot.lineupAIds) setLineupA(resolve(snapshot.lineupAIds))
          if (snapshot.benchAIds) setBenchA(resolve(snapshot.benchAIds))
          if (snapshot.lineupBIds) setLineupB(resolve(snapshot.lineupBIds))
          if (snapshot.benchBIds) setBenchB(resolve(snapshot.benchBIds))
          if (snapshot.playerStats) setPlayerStats(snapshot.playerStats)
          if (snapshot.actionLog) setActionLog(snapshot.actionLog)
          if (typeof snapshot.quarter === 'number') setQuarter(snapshot.quarter)
          if (typeof snapshot.quarterSeconds === 'number') setQuarterSeconds(snapshot.quarterSeconds)
          if (typeof snapshot.timeoutsA === 'number') setTimeoutsA(snapshot.timeoutsA)
          if (typeof snapshot.timeoutsB === 'number') setTimeoutsB(snapshot.timeoutsB)
          if (snapshot.possession) setPossession(snapshot.possession)
          setResumedFromSnapshot(true)
        }
      } catch (err) {
        console.error('Failed to load match:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setQuarterSeconds((s) => (s > 0 ? s - 1 : 0))
        setShotClock((s) => (s > 0 ? s - 1 : 0))
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  // When the game clock hits 0:00, auto-advance to the next quarter.
  // Team fouls are now auto-derived from quarter-tagged personal fouls
  // (see teamFoulsThisQuarter below), so there's nothing to manually
  // reset here anymore -- advancing the quarter number does that for free.
  useEffect(() => {
    if (quarterSeconds !== 0 || !running) return
    setRunning(false)

    const nextQuarter = quarter + 1
    setQuarter(nextQuarter)
    const nextLength =
      nextQuarter <= 4
        ? (tournament?.rules?.quarterMinutes ?? 10) * 60
        : (tournament?.rules?.otMinutes ?? 5) * 60
    setQuarterSeconds(nextLength)
    startRest(60)
  }, [quarterSeconds])

  useEffect(() => {
    if (restSeconds === null) return
    if (restSeconds <= 0) {
      setRestSeconds(null)
      return
    }
    const t = setTimeout(() => setRestSeconds((s) => (s !== null ? s - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [restSeconds])

  function startRest(duration) {
    setRestSeconds(duration)
  }

  function quarterLabel(q) {
    return q <= 4 ? `Q${q}` : `OT${q - 4}`
  }

  function formatClock(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
    const s = String(totalSeconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  function useTimeout(team) {
    if (team === 'A') setTimeoutsA((t) => Math.max(0, t - 1))
    else setTimeoutsB((t) => Math.max(0, t - 1))
    setRunning(false)
    startRest(60)
  }

  function buildSnapshot() {
    return {
      lineupAIds: lineupA.map((p) => p.id),
      benchAIds: benchA.map((p) => p.id),
      lineupBIds: lineupB.map((p) => p.id),
      benchBIds: benchB.map((p) => p.id),
      playerStats,
      actionLog,
      quarter,
      quarterSeconds,
      timeoutsA,
      timeoutsB,
      possession,
    }
  }

  useEffect(() => {
    if (!match) return
    const t = setTimeout(() => {
      saveLocalMatchState(matchId, tournamentId, buildSnapshot())
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playerStats, actionLog, quarter, quarterSeconds,
    lineupA, lineupB, benchA, benchB,
    timeoutsA, timeoutsB, possession, match,
  ])

  const snapshotRef = useRef(null)
  useEffect(() => {
    snapshotRef.current = buildSnapshot()
  })
  useEffect(() => {
    if (!match) return
    const interval = setInterval(() => {
      pushCloudMatchState(matchId, snapshotRef.current)
    }, 15000)
    return () => clearInterval(interval)
  }, [match, matchId])

  const foulLimit = tournament?.rules?.foulLimit ?? 5

  function playerTeam(playerId) {
    if (lineupA.some((p) => p.id === playerId) || benchA.some((p) => p.id === playerId)) return 'A'
    if (lineupB.some((p) => p.id === playerId) || benchB.some((p) => p.id === playerId)) return 'B'
    return null
  }

  function playerName(playerId) {
    const all = [...lineupA, ...benchA, ...lineupB, ...benchB]
    const p = all.find((pl) => pl.id === playerId)
    return p ? `#${p.jerseyNumber ?? '--'} ${p.name}` : 'Unknown player'
  }

  function logAction(entry) {
    setActionLog((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: new Date().toISOString(), reversed: false, ...entry },
    ])
  }

  function applyStatDelta(playerId, statKey, delta, quarterKey) {
    setPlayerStats((prev) => {
      const p = prev[playerId] ?? emptyStats()
      const updated = { ...p, [statKey]: p[statKey] + delta }
      if (quarterKey === 'byQuarter') {
        updated.byQuarter = { ...p.byQuarter, [quarter]: (p.byQuarter[quarter] ?? 0) + delta }
      }
      if (quarterKey === 'foulsByQuarter') {
        updated.foulsByQuarter = { ...p.foulsByQuarter, [quarter]: (p.foulsByQuarter[quarter] ?? 0) + delta }
      }
      return { ...prev, [playerId]: updated }
    })
  }

  function addPoints(playerId, pts) {
    setPlayerStats((prev) => {
      const p = prev[playerId] ?? emptyStats()
      return {
        ...prev,
        [playerId]: {
          ...p,
          points: p.points + pts,
          fgMade: p.fgMade + 1,
          fgAttempted: p.fgAttempted + 1,
          byQuarter: { ...p.byQuarter, [quarter]: (p.byQuarter[quarter] ?? 0) + pts },
        },
      }
    })
    logAction({ type: 'POINT', playerId, teamId: playerTeam(playerId), amount: pts, quarter })
  }

  // A missed shot -- counts toward attempts (for shooting %) but not
  // makes or points. Doesn't distinguish 2pt/3pt misses, keeping this
  // one simple button rather than splitting it further.
  function addMiss(playerId) {
    applyStatDelta(playerId, 'fgAttempted', 1, null)
    logAction({ type: 'MISS', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  function addPersonalFoul(playerId) {
    applyStatDelta(playerId, 'fouls', 1, 'foulsByQuarter')
    logAction({ type: 'FOUL', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  function addTurnover(playerId) {
    applyStatDelta(playerId, 'turnovers', 1, null)
    logAction({ type: 'TURNOVER', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  function addAssist(playerId) {
    applyStatDelta(playerId, 'assists', 1, null)
    logAction({ type: 'ASSIST', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  function addRebound(playerId) {
    applyStatDelta(playerId, 'rebounds', 1, null)
    logAction({ type: 'REBOUND', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  function addSteal(playerId) {
    applyStatDelta(playerId, 'steals', 1, null)
    logAction({ type: 'STEAL', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  function addBlock(playerId) {
    applyStatDelta(playerId, 'blocks', 1, null)
    logAction({ type: 'BLOCK', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  // Technical/flagrant fouls are tracked completely separately from
  // personal fouls, per the tournament rules we set up earlier -- they
  // don't count toward the foul-out limit.
  function addTechnicalFoul(playerId) {
    applyStatDelta(playerId, 'technicalFouls', 1, null)
    logAction({ type: 'TECHNICAL', playerId, teamId: playerTeam(playerId), amount: 1, quarter })
  }

  // Undo: reverses the most recent non-reversed action. Never deletes
  // it -- marks it reversed and adds a new CORRECTION entry, so the log
  // always shows exactly what happened, including the mistake and the fix.
  function undoLastAction() {
    const lastIndex = [...actionLog].reverse().find((a) => !a.reversed)
    if (!lastIndex) return
    const original = lastIndex

    if (original.type === 'POINT') {
      setPlayerStats((prev) => {
        const p = prev[original.playerId] ?? emptyStats()
        return {
          ...prev,
          [original.playerId]: {
            ...p,
            points: p.points - original.amount,
            fgMade: Math.max(0, p.fgMade - 1),
            fgAttempted: Math.max(0, p.fgAttempted - 1),
            byQuarter: { ...p.byQuarter, [original.quarter]: (p.byQuarter[original.quarter] ?? 0) - original.amount },
          },
        }
      })
    } else if (original.type === 'MISS') {
      applyStatDelta(original.playerId, 'fgAttempted', -1, null)
    } else {
      const statKeyFor = {
        FOUL: 'fouls', TURNOVER: 'turnovers', ASSIST: 'assists',
        REBOUND: 'rebounds', STEAL: 'steals', BLOCK: 'blocks', TECHNICAL: 'technicalFouls',
      }
      const quarterKeyFor = { FOUL: 'foulsByQuarter' }
      const statKey = statKeyFor[original.type]
      if (statKey) {
        applyStatDelta(original.playerId, statKey, -original.amount, quarterKeyFor[original.type] ?? null)
      }
    }

    setActionLog((prev) => [
      ...prev.map((a) => (a.id === original.id ? { ...a, reversed: true } : a)),
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'CORRECTION',
        playerId: original.playerId,
        teamId: original.teamId,
        amount: -original.amount,
        quarter: original.quarter,
        correctsEventId: original.id,
        correctsType: original.type,
        reversed: false,
      },
    ])
  }

  // Team fouls are auto-derived from personal fouls tagged to the
  // CURRENT quarter -- no manual counter, and it naturally resets each
  // quarter since it only counts fouls logged during that quarter,
  // while each player's total personal-foul count (used for foul-out)
  // keeps accumulating all game as before.
  function teamFoulsThisQuarter(lineup, bench) {
    return [...lineup, ...bench].reduce(
      (sum, p) => sum + (playerStats[p.id]?.foulsByQuarter?.[quarter] ?? 0),
      0
    )
  }

  function teamScore(lineup, bench) {
    return [...lineup, ...bench].reduce((sum, p) => sum + (playerStats[p.id]?.points ?? 0), 0)
  }

  const scoreA = teamScore(lineupA, benchA)
  const scoreB = teamScore(lineupB, benchB)
  const teamFoulsA = teamFoulsThisQuarter(lineupA, benchA)
  const teamFoulsB = teamFoulsThisQuarter(lineupB, benchB)

  function substitute(team, outPlayer, inPlayer) {
    if (team === 'A') {
      setLineupA((l) => l.map((p) => (p.id === outPlayer.id ? inPlayer : p)))
      setBenchA((b) => b.map((p) => (p.id === inPlayer.id ? outPlayer : p)))
      setSelectedA({ player: inPlayer, isBench: false })
    } else {
      setLineupB((l) => l.map((p) => (p.id === outPlayer.id ? inPlayer : p)))
      setBenchB((b) => b.map((p) => (p.id === inPlayer.id ? outPlayer : p)))
      setSelectedB({ player: inPlayer, isBench: false })
    }
    logAction({ type: 'SUB', playerId: inPlayer.id, teamId: team, amount: 0, quarter, note: `In for ${outPlayer.name}` })
  }

  function selectPlayer(team, player, isBench) {
    const selected = team === 'A' ? selectedA : selectedB
    const setSelected = team === 'A' ? setSelectedA : setSelectedB
    if (isBench && selected && !selected.isBench) {
      substitute(team, selected.player, player)
      return
    }
    setSelected({ player, isBench })
  }

  function allPlayersWithTeam() {
    return [
      ...lineupA.map((p) => ({ player: p, teamId: teamA?.id })),
      ...benchA.map((p) => ({ player: p, teamId: teamA?.id })),
      ...lineupB.map((p) => ({ player: p, teamId: teamB?.id })),
      ...benchB.map((p) => ({ player: p, teamId: teamB?.id })),
    ]
  }

  function suggestPotg() {
    const candidates = allPlayersWithTeam()
      .map(({ player }) => {
        const s = playerStats[player.id] ?? emptyStats()
        const missedShots = Math.max(0, s.fgAttempted - s.fgMade)
        // A simple, standard-ish efficiency estimate: positive plays
        // minus negatives -- close to the classic "EFF" stat used in
        // real box scores.
        const efficiency =
          s.points + s.rebounds + s.assists + s.steals + s.blocks
          - s.turnovers - missedShots - s.fouls * 0.5 - s.technicalFouls
        return { player, ...s, efficiency }
      })
      .filter((c) => c.points > 0 || c.fouls > 0 || c.turnovers > 0 || c.assists > 0 || c.rebounds > 0 || c.steals > 0 || c.blocks > 0)

    if (candidates.length === 0) return null
    candidates.sort((a, b) => b.efficiency - a.efficiency)
    return candidates[0].player.id
  }

  const [showPotgStep, setShowPotgStep] = useState(false)
  const [potgPlayerId, setPotgPlayerId] = useState(null)

  function handleComplete() {
    if (scoreA === scoreB) {
      setError('Scores are tied -- enter a final score with a winner before completing.')
      return
    }
    setError('')
    setPotgPlayerId(suggestPotg())
    setShowPotgStep(true)
  }

  async function confirmCompleteMatch() {
    setSaving(true)
    setError('')
    try {
      const playerStatsPayload = allPlayersWithTeam().map(({ player, teamId }) => {
        const s = playerStats[player.id] ?? emptyStats()
        return {
          playerId: player.id, teamId,
          points: s.points, fouls: s.fouls, turnovers: s.turnovers, assists: s.assists,
          rebounds: s.rebounds, steals: s.steals, blocks: s.blocks,
          technicalFouls: s.technicalFouls, fgMade: s.fgMade, fgAttempted: s.fgAttempted,
        }
      })
      await completeMatch(matchId, scoreA, scoreB, { playerStats: playerStatsPayload, potgPlayerId })
      await saveActionLog(matchId, actionLog)
      await clearMatchState(matchId)
      navigate(`/basketball/${tournamentId}/schedule`)
    } catch (err) {
      console.error('Failed to complete match:', err)
      setError(`Could not save the result: ${err.message ?? 'unknown error'}`)
      setSaving(false)
    }
  }

  if (!match || !tournament) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-500">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : (
          'Loading...'
        )}
      </div>
    )
  }

  const hasUndoable = actionLog.some((a) => !a.reversed)

  const sharedProps = {
    tournament, teamA, teamB, scoreA, scoreB, teamFoulsA, teamFoulsB,
    lineupA, benchA, lineupB, benchB,
    playerStats, foulLimit,
    selectedA, selectedB, selectPlayer,
    addPoints, addPersonalFoul, addTurnover, addAssist,
    addMiss, addRebound, addSteal, addBlock, addTechnicalFoul,
    quarter, quarterLabel,
    quarterSeconds, setQuarterSeconds, running, setRunning,
    shotClock, setShotClock, timeoutsA, timeoutsB, useTimeout,
    possession, setPossession,
    restSeconds, setRestSeconds,
    formatClock, saving, handleComplete, error,
    undoLastAction, hasUndoable, showLogModal, setShowLogModal,
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <Link to={`/basketball/${tournamentId}/schedule`} className="text-sm text-slate-400 hover:text-slate-600">
          ← Back to schedule
        </Link>
        {resumedFromSnapshot && (
          <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Resumed from saved progress
          </span>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isDesktop ? (
        <div style={{ height: 'calc(100vh - 88px)' }}>
          <DesktopGrid {...sharedProps} />
        </div>
      ) : (
        <MobileStack {...sharedProps} />
      )}

      {showPotgStep && (
        <PotgOverlay
          teamA={teamA}
          teamB={teamB}
          scoreA={scoreA}
          scoreB={scoreB}
          candidates={allPlayersWithTeam()}
          playerStats={playerStats}
          potgPlayerId={potgPlayerId}
          onSelect={setPotgPlayerId}
          onConfirm={confirmCompleteMatch}
          onBack={() => setShowPotgStep(false)}
          saving={saving}
          error={error}
        />
      )}

      {showLogModal && (
        <ActionLogOverlay
          actionLog={actionLog}
          playerName={playerName}
          teamName={(t) => (t === 'A' ? teamA?.name : t === 'B' ? teamB?.name : '')}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </div>
  )
}

function PotgOverlay({ teamA, teamB, scoreA, scoreB, candidates, playerStats, potgPlayerId, onSelect, onConfirm, onBack, saving, error }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Player of the Game</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Final: {teamA?.name} {scoreA} &middot; {teamB?.name} {scoreB}
          </p>
        </div>

        {error && (
          <div className="mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {candidates.length === 0 && (
            <p className="text-sm text-slate-400 px-2 py-4">
              No player stats were recorded this game -- you can skip choosing a Player of the Game.
            </p>
          )}
          {candidates.map(({ player, teamId }) => {
            const s = playerStats[player.id] ?? emptyStats()
            const isSuggested = player.id === potgPlayerId
            const teamName = teamId === teamA?.id ? teamA?.name : teamB?.name
            return (
              <button
                key={player.id}
                onClick={() => onSelect(player.id)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 my-1 text-left transition ${
                  isSuggested ? 'border-orange-400 bg-orange-50' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium text-slate-800">
                    #{player.jerseyNumber ?? '--'} {player.name}
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">{teamName}</span>
                </span>
                <span className="text-xs text-slate-500 shrink-0 ml-2">
                  {s.points}p &middot; {s.assists}a &middot; {s.fouls}f &middot; {s.turnovers}to
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-3 py-3 border-t border-slate-100 flex gap-2">
          <button
            onClick={onBack}
            className="flex-1 rounded-lg border border-slate-300 text-slate-600 font-medium py-2.5 hover:bg-slate-50 transition"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Confirm & Complete Match'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ACTION_LABEL = {
  POINT: 'pts', FOUL: 'foul', TURNOVER: 'turnover', ASSIST: 'assist',
  REBOUND: 'rebound', STEAL: 'steal', BLOCK: 'block', MISS: 'missed shot',
  TECHNICAL: 'technical foul', CORRECTION: 'correction', SUB: 'sub',
}

function ActionLogOverlay({ actionLog, playerName, teamName, onClose }) {
  const reversed = [...actionLog].reverse()
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Game Log</h2>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {reversed.length === 0 && (
            <p className="text-sm text-slate-400 px-2 py-4">Nothing logged yet.</p>
          )}
          {reversed.map((a) => (
            <div
              key={a.id}
              className={`text-xs px-2 py-1.5 my-0.5 rounded-md ${
                a.type === 'CORRECTION' ? 'bg-amber-50 text-amber-800' : a.reversed ? 'text-slate-300 line-through' : 'text-slate-600'
              }`}
            >
              Q{a.quarter} &middot; {teamName(a.teamId)} &middot; {playerName(a.playerId)} &middot;{' '}
              {a.type === 'CORRECTION' ? `correction (${a.amount > 0 ? '+' : ''}${a.amount} ${ACTION_LABEL[a.correctsType]})` : `${ACTION_LABEL[a.type]}${a.amount ? ` (${a.amount > 0 ? '+' : ''}${a.amount})` : ''}${a.note ? ` -- ${a.note}` : ''}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DesktopGrid(props) {
  const {
    teamA, teamB, scoreA, scoreB, teamFoulsA, teamFoulsB, lineupA, benchA, lineupB, benchB,
    playerStats, foulLimit, selectedA, selectedB, selectPlayer,
    addPoints, addPersonalFoul, addTurnover, addAssist,
    addMiss, addRebound, addSteal, addBlock, addTechnicalFoul,
    quarter, quarterLabel,
    quarterSeconds, setQuarterSeconds, running, setRunning,
    shotClock, setShotClock, timeoutsA, timeoutsB, useTimeout,
    possession, setPossession, restSeconds, setRestSeconds,
    formatClock, saving, handleComplete, tournament,
    undoLastAction, hasUndoable, setShowLogModal,
  } = props

  const statActions = { addPoints, addPersonalFoul, addTurnover, addAssist, addMiss, addRebound, addSteal, addBlock, addTechnicalFoul }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gap: '8px', height: '100%' }}>
      <div style={{ gridColumn: '1 / 3', gridRow: '1 / 5', minHeight: 0 }}>
        <TeamPanel
          team={teamA} score={scoreA} teamFouls={teamFoulsA} lineup={lineupA}
          stats={playerStats} foulLimit={foulLimit} selected={selectedA}
          onSelect={(p, b) => selectPlayer('A', p, b)}
          actions={statActions}
          compact
        />
      </div>

      <div style={{ gridColumn: '3 / 5', gridRow: '1 / 5', minHeight: 0 }}>
        <TeamPanel
          team={teamB} score={scoreB} teamFouls={teamFoulsB} lineup={lineupB}
          stats={playerStats} foulLimit={foulLimit} selected={selectedB}
          onSelect={(p, b) => selectPlayer('B', p, b)}
          actions={statActions}
          compact
        />
      </div>

      <RailPanel style={{ gridColumn: '5 / 6', gridRow: '1 / 2' }}>
        {restSeconds !== null ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-amber-600 font-medium uppercase">Rest</p>
              <span className="font-mono font-bold text-amber-700">{formatClock(restSeconds)}</span>
            </div>
            <button onClick={() => setRestSeconds(null)} className="text-[10px] rounded border border-slate-300 px-1.5 py-1 hover:bg-slate-50 transition">
              Skip
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-slate-400 uppercase">{quarterLabel(quarter)}</p>
              <span className="font-mono font-bold text-slate-900">{formatClock(quarterSeconds ?? 0)}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setRunning((r) => !r)} className="text-[10px] font-medium rounded bg-orange-500 hover:bg-orange-600 text-white px-1.5 py-1 transition">
                {running ? 'II' : '▶'}
              </button>
              <button onClick={() => { setRunning(false); setQuarterSeconds((tournament.rules?.quarterMinutes ?? 10) * 60) }} className="text-[10px] font-medium rounded border border-slate-300 px-1.5 py-1 hover:bg-slate-50 transition">
                ↺
              </button>
            </div>
          </div>
        )}
      </RailPanel>

      <RailPanel style={{ gridColumn: '5 / 6', gridRow: '2 / 3' }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Shot clock</span>
          <span className={`font-mono font-bold ${shotClock <= 5 ? 'text-red-500' : 'text-slate-900'}`}>{shotClock}</span>
        </div>
        <div className="flex gap-1 mt-1">
          <button onClick={() => setShotClock(24)} className="flex-1 text-[10px] rounded border border-slate-300 py-1 hover:bg-slate-50 transition">24</button>
          <button onClick={() => setShotClock(14)} className="flex-1 text-[10px] rounded border border-slate-300 py-1 hover:bg-slate-50 transition">14</button>
        </div>
      </RailPanel>

      <RailPanel style={{ gridColumn: '5 / 6', gridRow: '3 / 4' }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Possession</span>
          <button onClick={() => setPossession((p) => (p === 'left' ? 'right' : 'left'))} className="text-base font-bold text-orange-600">
            {possession === 'left' ? '←' : '→'}
          </button>
        </div>
      </RailPanel>

      <RailPanel style={{ gridColumn: '5 / 6', gridRow: '4 / 5' }}>
        <div className="flex flex-col gap-1 text-[10px]">
          <button onClick={() => useTimeout('A')} disabled={!timeoutsA} className="rounded border border-slate-300 px-1 py-1 hover:bg-slate-50 transition disabled:opacity-30">
            TO {teamA?.name ?? 'A'} ({timeoutsA ?? 0})
          </button>
          <button onClick={() => useTimeout('B')} disabled={!timeoutsB} className="rounded border border-slate-300 px-1 py-1 hover:bg-slate-50 transition disabled:opacity-30">
            TO {teamB?.name ?? 'B'} ({timeoutsB ?? 0})
          </button>
        </div>
      </RailPanel>

      {/* Bench panels now span both columns each, since team-foul cards were removed */}
      <div style={{ gridColumn: '1 / 3', gridRow: '5 / 7', minHeight: 0 }}>
        <BenchPanel team={teamA} bench={benchA} stats={playerStats} selected={selectedA} onSelect={(p) => selectPlayer('A', p, true)} />
      </div>
      <div style={{ gridColumn: '3 / 5', gridRow: '5 / 7', minHeight: 0 }}>
        <BenchPanel team={teamB} bench={benchB} stats={playerStats} selected={selectedB} onSelect={(p) => selectPlayer('B', p, true)} />
      </div>

      <RailPanel style={{ gridColumn: '5 / 6', gridRow: '5 / 6' }}>
        <div className="flex flex-col gap-1">
          <button
            onClick={undoLastAction}
            disabled={!hasUndoable}
            className="text-[10px] rounded border border-slate-300 px-1.5 py-1 hover:bg-slate-50 transition disabled:opacity-30"
          >
            Undo last
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="text-[10px] rounded border border-slate-300 px-1.5 py-1 hover:bg-slate-50 transition"
          >
            View log
          </button>
        </div>
      </RailPanel>

      <div style={{ gridColumn: '5 / 6', gridRow: '6 / 7' }}>
        <button
          onClick={handleComplete}
          disabled={saving}
          className="w-full h-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Complete Match'}
        </button>
      </div>
    </div>
  )
}

function RailPanel({ style, children }) {
  return (
    <div
      style={{ ...style, minHeight: 0, overflow: 'hidden' }}
      className="rounded-xl border border-slate-200 bg-white p-2"
    >
      {children}
    </div>
  )
}

// Complete literal class strings per color -- Tailwind's scanner needs
// these to appear whole in the source, not built from a template
// literal at runtime (that silently produces unstyled buttons, which
// bit us once already with the court circles).
const STAT_BTN_COLORS = {
  red: 'border-red-300 text-red-600 hover:bg-red-50',
  slate: 'border-slate-300 text-slate-600 hover:bg-slate-100',
  sky: 'border-sky-300 text-sky-600 hover:bg-sky-50',
  violet: 'border-violet-300 text-violet-600 hover:bg-violet-50',
  emerald: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50',
  amber: 'border-amber-300 text-amber-600 hover:bg-amber-50',
}

function SmallStatBtn({ label, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-md border font-medium py-1 text-[11px] transition disabled:opacity-30 ${STAT_BTN_COLORS[color]}`}
    >
      {label}
    </button>
  )
}

function TeamPanel({ team, score, teamFouls, lineup, stats, foulLimit, selected, onSelect, actions, compact }) {
  const selectedFouls = selected ? (stats[selected.player.id]?.fouls ?? 0) : 0
  const selectedFouledOut = selected && !selected.isBench && selectedFouls >= foulLimit
  const canAct = selected && !selected.isBench
  const pid = selected?.player.id

  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden">
      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <span className="font-medium text-slate-800 truncate text-sm">{team?.name ?? 'TBD'}</span>
        <div className="text-right">
          <span className="text-lg font-bold text-slate-900">{score}</span>
          <span className="block text-[10px] text-slate-400 -mt-0.5">Team fouls: {teamFouls}</span>
        </div>
      </div>

      <div className="px-2 py-1.5 border-b border-slate-100 bg-slate-50 shrink-0">
        <p className="text-[10px] text-slate-500 mb-1 truncate">
          {selected ? `#${selected.player.jerseyNumber ?? '--'} ${selected.player.name}` : 'Tap a player'}
        </p>
        <div className="flex gap-1 mb-1">
          {[1, 2, 3].map((pts) => (
            <button
              key={pts}
              onClick={() => canAct && actions.addPoints(pid, pts)}
              disabled={!canAct}
              className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 text-sm transition disabled:opacity-30"
            >
              +{pts}
            </button>
          ))}
          <button
            onClick={() => canAct && actions.addMiss(pid)}
            disabled={!canAct}
            className="flex-1 rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 font-medium py-1.5 text-[11px] transition disabled:opacity-30"
          >
            Miss
          </button>
        </div>
        <div className="flex gap-1 mb-1">
          <SmallStatBtn label="Foul" color="red" onClick={() => canAct && actions.addPersonalFoul(pid)} disabled={!canAct} />
          <SmallStatBtn label="TOV" color="slate" onClick={() => canAct && actions.addTurnover(pid)} disabled={!canAct} />
          <SmallStatBtn label="AST" color="sky" onClick={() => canAct && actions.addAssist(pid)} disabled={!canAct} />
        </div>
        <div className="flex gap-1">
          <SmallStatBtn label="REB" color="violet" onClick={() => canAct && actions.addRebound(pid)} disabled={!canAct} />
          <SmallStatBtn label="STL" color="emerald" onClick={() => canAct && actions.addSteal(pid)} disabled={!canAct} />
          <SmallStatBtn label="BLK" color="amber" onClick={() => canAct && actions.addBlock(pid)} disabled={!canAct} />
          <SmallStatBtn label="Tech" color="red" onClick={() => canAct && actions.addTechnicalFoul(pid)} disabled={!canAct} />
        </div>
        {selectedFouledOut && (
          <p className="text-[10px] text-red-600 font-medium mt-1">Fouled out -- sub from bench below</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1">
        {lineup.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            fouls={stats[player.id]?.fouls ?? 0}
            turnovers={stats[player.id]?.turnovers ?? 0}
            assists={stats[player.id]?.assists ?? 0}
            foulLimit={foulLimit}
            selected={selected?.player.id === player.id && !selected.isBench}
            onTap={() => onSelect(player, false)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  )
}

function BenchPanel({ team, bench, stats, selected, onSelect }) {
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-1.5 overflow-y-auto">
      <p className="text-[10px] font-semibold text-slate-400 uppercase px-1 pt-0.5 truncate">{team?.name} bench</p>
      {bench.length === 0 && <p className="text-[10px] text-slate-300 px-1 pt-1">Empty</p>}
      <div className="grid grid-cols-2 gap-1">
        {bench.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            fouls={stats[player.id]?.fouls ?? 0}
            turnovers={stats[player.id]?.turnovers ?? 0}
            assists={stats[player.id]?.assists ?? 0}
            foulLimit={99}
            selected={selected?.player.id === player.id && selected.isBench}
            onTap={() => onSelect(player)}
            compact
          />
        ))}
      </div>
    </div>
  )
}

function PlayerRow({ player, fouls, turnovers = 0, assists = 0, foulLimit, selected, onTap, compact }) {
  const fouledOut = fouls >= foulLimit
  const warning = fouls === foulLimit - 1

  let rowClasses = 'border-transparent hover:bg-slate-50'
  if (selected) rowClasses = 'border-orange-400 bg-orange-50'
  else if (fouledOut) rowClasses = 'border-transparent bg-red-50'
  else if (warning) rowClasses = 'border-transparent bg-amber-50'

  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center justify-between rounded-md border px-1.5 ${compact ? 'py-1' : 'py-1.5'} my-0.5 text-left transition ${rowClasses}`}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-bold text-slate-700 w-5 text-center shrink-0">{player.jerseyNumber ?? '--'}</span>
        <span className="text-xs text-slate-800 truncate">{player.name}</span>
      </span>
      <span className="flex items-center gap-1 shrink-0">
        {fouledOut && <span className="text-[9px] font-bold bg-red-500 text-white rounded px-1">OUT</span>}
        {!fouledOut && fouls > 0 && (
          <span className={`text-[10px] ${warning ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>{fouls}F</span>
        )}
        {turnovers > 0 && <span className="text-[10px] text-slate-400">{turnovers}TO</span>}
        {assists > 0 && <span className="text-[10px] text-sky-500">{assists}A</span>}
      </span>
    </button>
  )
}

function MobileStack(props) {
  const {
    teamA, teamB, scoreA, scoreB, teamFoulsA, teamFoulsB, lineupA, benchA, lineupB, benchB,
    playerStats, foulLimit, selectedA, selectedB, selectPlayer,
    addPoints, addPersonalFoul, addTurnover, addAssist,
    addMiss, addRebound, addSteal, addBlock, addTechnicalFoul,
    quarter, quarterLabel,
    quarterSeconds, setQuarterSeconds, running, setRunning,
    shotClock, setShotClock, timeoutsA, timeoutsB, useTimeout,
    possession, setPossession, restSeconds, setRestSeconds,
    formatClock, saving, handleComplete, tournament,
    undoLastAction, hasUndoable, setShowLogModal,
  } = props

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2">
        {restSeconds !== null ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-amber-600 font-medium uppercase">Rest / Timeout</p>
              <span className="text-lg font-mono font-bold text-amber-700">{formatClock(restSeconds)}</span>
            </div>
            <button onClick={() => setRestSeconds(null)} className="text-xs font-medium rounded-md border border-slate-300 px-2.5 py-1 hover:bg-slate-50 transition">
              Skip Rest
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase">{quarterLabel(quarter)}</p>
              <span className="text-lg font-mono font-bold text-slate-900">{formatClock(quarterSeconds ?? 0)}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setRunning((r) => !r)} className="text-xs font-medium rounded-md bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 transition">
                {running ? 'Pause' : 'Start'}
              </button>
              <button onClick={() => { setRunning(false); setQuarterSeconds((tournament.rules?.quarterMinutes ?? 10) * 60) }} className="text-xs font-medium rounded-md border border-slate-300 text-slate-600 px-2.5 py-1 hover:bg-slate-50 transition">
                Reset
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">Shot clock</span>
          <span className={`font-mono font-bold ${shotClock <= 5 ? 'text-red-500' : 'text-slate-900'}`}>{shotClock}</span>
          <div className="flex gap-1">
            <button onClick={() => setShotClock(24)} className="text-[11px] rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 transition">24</button>
            <button onClick={() => setShotClock(14)} className="text-[11px] rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 transition">14</button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">Possession</span>
          <button onClick={() => setPossession((p) => (p === 'left' ? 'right' : 'left'))} className="text-lg font-bold text-orange-600">
            {possession === 'left' ? '←' : '→'}
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
          <button onClick={() => useTimeout('A')} disabled={!timeoutsA} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 transition disabled:opacity-30">TO A ({timeoutsA ?? 0})</button>
          <button onClick={() => useTimeout('B')} disabled={!timeoutsB} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 transition disabled:opacity-30">TO B ({timeoutsB ?? 0})</button>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
          <button onClick={undoLastAction} disabled={!hasUndoable} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 transition disabled:opacity-30">Undo last</button>
          <button onClick={() => setShowLogModal(true)} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 transition">View log</button>
        </div>
      </div>

      {[
        { team: teamA, score: scoreA, teamFouls: teamFoulsA, lineup: lineupA, bench: benchA, selected: selectedA, key: 'A' },
        { team: teamB, score: scoreB, teamFouls: teamFoulsB, lineup: lineupB, bench: benchB, selected: selectedB, key: 'B' },
      ].map(({ team, score, teamFouls, lineup, bench, selected, key }) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="font-medium text-slate-800 truncate">{team?.name ?? 'TBD'}</span>
            <div className="text-right">
              <span className="text-xl font-bold text-slate-900">{score}</span>
              <span className="block text-[10px] text-slate-400 -mt-0.5">Team fouls: {teamFouls}</span>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500 mb-1.5 truncate">
              {selected ? `Scoring: #${selected.player.jerseyNumber ?? '--'} ${selected.player.name}` : 'Tap a player to select them'}
            </p>
            <div className="flex gap-1.5 mb-1.5">
              {[1, 2, 3].map((pts) => (
                <button
                  key={pts}
                  onClick={() => selected && !selected.isBench && addPoints(selected.player.id, pts)}
                  disabled={!selected || selected.isBench}
                  className="flex-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 transition disabled:opacity-30"
                >
                  +{pts}
                </button>
              ))}
              <button
                onClick={() => selected && !selected.isBench && addMiss(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                Miss
              </button>
            </div>
            <div className="flex gap-1.5 mb-1.5">
              <button
                onClick={() => selected && !selected.isBench && addPersonalFoul(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                Foul
              </button>
              <button
                onClick={() => selected && !selected.isBench && addTurnover(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                TOV
              </button>
              <button
                onClick={() => selected && !selected.isBench && addAssist(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-sky-300 text-sky-600 hover:bg-sky-50 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                AST
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => selected && !selected.isBench && addRebound(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-violet-300 text-violet-600 hover:bg-violet-50 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                REB
              </button>
              <button
                onClick={() => selected && !selected.isBench && addSteal(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-emerald-300 text-emerald-600 hover:bg-emerald-50 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                STL
              </button>
              <button
                onClick={() => selected && !selected.isBench && addBlock(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-50 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                BLK
              </button>
              <button
                onClick={() => selected && !selected.isBench && addTechnicalFoul(selected.player.id)}
                disabled={!selected || selected.isBench}
                className="flex-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2 text-sm transition disabled:opacity-30"
              >
                Tech
              </button>
            </div>
          </div>
          <div className="px-2 py-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase px-1 pt-1">On court</p>
            {lineup.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                fouls={playerStats[player.id]?.fouls ?? 0}
                turnovers={playerStats[player.id]?.turnovers ?? 0}
                assists={playerStats[player.id]?.assists ?? 0}
                foulLimit={foulLimit}
                selected={selected?.player.id === player.id && !selected.isBench}
                onTap={() => selectPlayer(key, player, false)}
              />
            ))}
          </div>
          {bench.length > 0 && (
            <div className="px-2 py-1.5 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase px-1 pt-1">Bench</p>
              {bench.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  fouls={playerStats[player.id]?.fouls ?? 0}
                  turnovers={playerStats[player.id]?.turnovers ?? 0}
                  assists={playerStats[player.id]?.assists ?? 0}
                  foulLimit={foulLimit}
                  selected={selected?.player.id === player.id && selected.isBench}
                  onTap={() => selectPlayer(key, player, true)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={handleComplete}
        disabled={saving}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 transition disabled:opacity-50"
      >
        {saving ? 'Saving result...' : 'Complete Match & Advance Winner'}
      </button>
    </div>
  )
}

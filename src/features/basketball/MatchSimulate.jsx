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
import { TEAM_CLASS } from '../../lib/teamColors'
import usePortrait from '../../hooks/usePortrait'

const emptyStats = () => ({
  points: 0, fouls: 0, turnovers: 0, assists: 0,
  rebounds: 0, steals: 0, blocks: 0, technicalFouls: 0,
  fgMade: 0, fgAttempted: 0,
  byQuarter: {}, foulsByQuarter: {},
})

export default function MatchSimulate() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()
  const portrait = usePortrait()

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
  // One selection at a time, from either team: { team: 'A' | 'B', player }.
  // The action buttons always act on this player.
  const [selected, setSelected] = useState(null)
  const [sheet, setSheet] = useState(null) // null | 'sub'

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

  function resetQuarterClock() {
    setRunning(false)
    setQuarterSeconds((tournament?.rules?.quarterMinutes ?? 10) * 60)
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
    } else {
      setLineupB((l) => l.map((p) => (p.id === outPlayer.id ? inPlayer : p)))
      setBenchB((b) => b.map((p) => (p.id === inPlayer.id ? outPlayer : p)))
    }
    // The incoming player takes over the selection so scoring can continue.
    setSelected({ team, player: inPlayer })
    logAction({ type: 'SUB', playerId: inPlayer.id, teamId: team, amount: 0, quarter, note: `In for ${outPlayer.name}` })
  }

  function selectPlayer(team, player) {
    setSelected((cur) => (cur?.team === team && cur.player.id === player.id ? null : { team, player }))
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
      <div className="max-w-3xl mx-auto px-4 py-10 text-ink-dim">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        ) : (
          'Loading...'
        )}
      </div>
    )
  }

  const hasUndoable = actionLog.some((a) => !a.reversed)

  // ---------- The selected player ----------
  const selTeam = selected?.team ?? null
  const selPlayer = selected?.player ?? null
  const selStats = selPlayer ? (playerStats[selPlayer.id] ?? emptyStats()) : null
  const selBench = selTeam === 'A' ? benchA : selTeam === 'B' ? benchB : []
  const selTeamObj = selTeam === 'A' ? teamA : selTeam === 'B' ? teamB : null
  const selFouledOut = !!selStats && selStats.fouls >= foulLimit

  // Every button on the right acts on the selected player.
  const pid = selPlayer?.id
  const actionButtons = [
    { key: 'p1', label: '+1', kind: 'points', run: () => addPoints(pid, 1) },
    { key: 'p2', label: '+2', kind: 'points', run: () => addPoints(pid, 2) },
    { key: 'p3', label: '+3', kind: 'points', run: () => addPoints(pid, 3) },
    { key: 'miss', label: 'Miss', color: 'slate', run: () => addMiss(pid) },
    { key: 'foul', label: 'Foul', color: 'red', run: () => addPersonalFoul(pid) },
    { key: 'tov', label: 'TOV', color: 'slate', run: () => addTurnover(pid) },
    { key: 'ast', label: 'AST', color: 'sky', run: () => addAssist(pid) },
    { key: 'reb', label: 'REB', color: 'violet', run: () => addRebound(pid) },
    { key: 'stl', label: 'STL', color: 'emerald', run: () => addSteal(pid) },
    { key: 'blk', label: 'BLK', color: 'amber', run: () => addBlock(pid) },
    { key: 'tech', label: 'Tech', color: 'red', run: () => addTechnicalFoul(pid) },
  ]

  // ---------- Full-screen layout, no scrolling ----------
  return (
    <div className="fixed inset-0 z-40 bg-page flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-line">
        <Link to={`/basketball/${tournamentId}/schedule`} className="text-xs text-ink-faint hover:text-ink-dim shrink-0">
          ← Schedule
        </Link>
        {resumedFromSnapshot && !portrait ? (
          <span className="text-[11px] font-medium text-accent flex items-center gap-1 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            Resumed from saved progress
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={undoLastAction}
            disabled={!hasUndoable}
            className="text-xs rounded-md border border-line-strong text-ink-dim hover:bg-panel-alt px-2 py-1 transition disabled:opacity-30"
          >
            ↶ Undo
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="text-xs rounded-md border border-line-strong text-ink-dim hover:bg-panel-alt px-2 py-1 transition"
          >
            Log
          </button>
          <button
            onClick={handleComplete}
            disabled={saving}
            className="text-xs rounded-md bg-accent-strong hover:bg-accent text-on-accent font-medium px-2.5 py-1 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Complete'}
          </button>
        </div>
      </div>
      {error && !showPotgStep && <div className="shrink-0 bg-live-soft px-3 py-1 text-xs text-live">{error}</div>}

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '3fr 1fr' }}>
        <div className="min-w-0 min-h-0 flex flex-col gap-2 p-2">
          <Scoreboard
            portrait={portrait}
            teamA={teamA}
            teamB={teamB}
            scoreA={scoreA}
            scoreB={scoreB}
            teamFoulsA={teamFoulsA}
            teamFoulsB={teamFoulsB}
            timeoutsA={timeoutsA}
            timeoutsB={timeoutsB}
            onTimeout={useTimeout}
            quarter={quarter}
            quarterLabel={quarterLabel}
            quarterSeconds={quarterSeconds}
            running={running}
            setRunning={setRunning}
            onResetClock={resetQuarterClock}
            shotClock={shotClock}
            setShotClock={setShotClock}
            possession={possession}
            setPossession={setPossession}
            restSeconds={restSeconds}
            setRestSeconds={setRestSeconds}
            formatClock={formatClock}
          />
          <div className="flex-1 min-h-0 relative">
            <BasketballCourt
              portrait={portrait}
              lineupA={lineupA}
              lineupB={lineupB}
              playerStats={playerStats}
              foulLimit={foulLimit}
              selected={selected}
              onSelectPlayer={selectPlayer}
            />
          </div>
        </div>

        <ActionColumn
          portrait={portrait}
          team={selTeam}
          teamName={selTeamObj?.name}
          player={selPlayer}
          stats={selStats}
          foulLimit={foulLimit}
          fouledOut={selFouledOut}
          actions={actionButtons}
          onOpenSub={() => setSheet('sub')}
        />
      </div>

      {sheet === 'sub' && selPlayer && (
        <Sheet title={`Substitute · ${selTeamObj?.name ?? ''}`} onClose={() => setSheet(null)}>
          <p className="text-sm text-ink-dim mb-3">
            Replace <span className="font-medium text-ink">#{selPlayer.jerseyNumber ?? '--'} {selPlayer.name}</span> with:
          </p>
          {selBench.length === 0 ? (
            <p className="text-sm text-ink-dim">No bench players available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {selBench.map((p) => {
                const f = playerStats[p.id]?.fouls ?? 0
                const out = f >= foulLimit
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      substitute(selTeam, selPlayer, p)
                      setSheet(null)
                    }}
                    className={`rounded-md border px-2 py-3 text-sm text-left transition hover:border-accent hover:bg-accent-soft ${
                      out ? 'border-live bg-live-soft text-ink' : 'border-line-strong text-ink'
                    }`}
                  >
                    <span className="block truncate">
                      <span className="text-ink-faint">#{p.jerseyNumber ?? '--'} </span>
                      {p.name}
                    </span>
                    {(f > 0 || out) && (
                      <span className={`block text-[10px] ${out ? 'text-live font-medium' : 'text-ink-faint'}`}>
                        {out ? 'Fouled out' : `${f} foul${f === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Sheet>
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

// Complete literal class strings per color -- Tailwind's scanner needs
// these to appear whole in the source, not built from a template
// literal at runtime.
const STAT_BTN_COLORS = {
  red: 'border-live text-live hover:bg-live-soft',
  slate: 'border-line-strong text-ink-dim hover:bg-panel-alt',
  sky: 'border-sky-600 text-sky-400 hover:bg-panel-alt',
  violet: 'border-violet-600 text-violet-400 hover:bg-panel-alt',
  emerald: 'border-accent text-accent hover:bg-accent-soft',
  amber: 'border-warn text-warn hover:bg-warn-soft',
}

/** Simple modal used for the substitute picker. */
function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-xl border border-line bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-ink">{title}</p>
          <button
            onClick={onClose}
            className="text-xs rounded-md border border-line-strong text-ink-dim hover:bg-panel-alt px-2 py-1 transition"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Scores, team fouls, timeouts, game clock, shot clock and possession. */
function Scoreboard({
  portrait, teamA, teamB, scoreA, scoreB, teamFoulsA, teamFoulsB, timeoutsA, timeoutsB, onTimeout,
  quarter, quarterLabel, quarterSeconds, running, setRunning, onResetClock,
  shotClock, setShotClock, possession, setPossession, restSeconds, setRestSeconds, formatClock,
}) {
  const block = (side, team, score, teamFouls, timeouts) => {
    const right = side === 'B'
    return (
      <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
        <p className={`flex items-center gap-1 text-xs lg:text-sm font-medium text-ink min-w-0 ${right ? 'flex-row-reverse' : ''}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
          <span className="truncate">{team?.name ?? 'TBD'}</span>
        </p>
        <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
          <span className="text-3xl lg:text-5xl font-display font-bold text-accent leading-none">{score}</span>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onTimeout(side)}
              disabled={!timeouts}
              className="text-[10px] rounded border border-line-strong text-ink-dim hover:bg-panel-alt px-1.5 py-0.5 transition disabled:opacity-30"
            >
              TO · {timeouts ?? 0}
            </button>
            <span className="text-[10px] text-ink-faint">Fouls {teamFouls}</span>
          </div>
        </div>
      </div>
    )
  }

  const clocks = (
    <div className="min-w-0 text-center">
      {restSeconds !== null ? (
        <div className="flex items-center justify-center gap-2">
          <div>
            <p className="text-[9px] text-warn font-medium uppercase">Rest / timeout</p>
            <span className="text-2xl lg:text-4xl font-display font-bold text-warn leading-none">{formatClock(restSeconds)}</span>
          </div>
          <button
            onClick={() => setRestSeconds(null)}
            className="text-[10px] rounded border border-line-strong text-ink-dim hover:bg-panel-alt px-1.5 py-1 transition"
          >
            Skip
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <div>
            <p className="text-[10px] text-ink-faint uppercase">{quarterLabel(quarter)}</p>
            <span className="text-2xl lg:text-4xl font-display font-bold text-ink leading-none">{formatClock(quarterSeconds ?? 0)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setRunning((r) => !r)}
              className="text-[10px] font-medium rounded bg-accent hover:bg-accent-strong text-on-accent px-2 py-0.5 transition"
            >
              {running ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={onResetClock}
              className="text-[10px] rounded border border-line-strong text-ink-dim hover:bg-panel-alt px-2 py-0.5 transition"
            >
              Reset
            </button>
          </div>
        </div>
      )}
      <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-ink-dim">
        <span>Shot</span>
        <span className={`text-sm font-display font-bold ${shotClock <= 5 ? 'text-live' : 'text-ink'}`}>{shotClock}</span>
        <button onClick={() => setShotClock(24)} className="rounded border border-line-strong px-1.5 py-0.5 hover:bg-panel-alt transition">24</button>
        <button onClick={() => setShotClock(14)} className="rounded border border-line-strong px-1.5 py-0.5 hover:bg-panel-alt transition">14</button>
        <button
          onClick={() => setPossession((p) => (p === 'left' ? 'right' : 'left'))}
          title="Possession"
          className="rounded border border-line-strong px-1.5 py-0.5 text-sm font-bold text-accent hover:bg-panel-alt transition leading-none"
        >
          {possession === 'left' ? '←' : '→'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="shrink-0 rounded-xl border border-line bg-panel px-2.5 py-1.5">
      {portrait ? (
        <>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {block('A', teamA, scoreA, teamFoulsA, timeoutsA)}
            {block('B', teamB, scoreB, teamFoulsB, timeoutsB)}
          </div>
          <div className="mt-1.5 border-t border-line pt-1.5">{clocks}</div>
        </>
      ) : (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
          {block('A', teamA, scoreA, teamFoulsA, timeoutsA)}
          {clocks}
          {block('B', teamB, scoreB, teamFoulsB, timeoutsB)}
        </div>
      )}
    </div>
  )
}

/** The right-hand column: stat buttons for whichever player is selected. */
function ActionColumn({ portrait, team, teamName, player, stats, foulLimit, fouledOut, actions, onOpenSub }) {
  const cols = portrait ? 1 : 2
  const items = actions.length + 1
  const rows = Math.ceil(items / cols)
  const has = !!player

  return (
    <div className="min-w-0 min-h-0 flex flex-col gap-1.5 border-l border-line bg-panel p-1.5">
      <div className="shrink-0 min-h-[2.25rem]">
        {has ? (
          <>
            <p className="text-[10px] text-ink-faint truncate flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[team].bg}`} />
              {teamName}
            </p>
            <p className="text-xs font-medium text-ink truncate">
              #{player.jerseyNumber ?? '--'} {player.name}
            </p>
            <p className={`text-[10px] truncate ${fouledOut ? 'text-live font-medium' : 'text-ink-faint'}`}>
              {fouledOut ? 'Fouled out -- sub' : `${stats?.points ?? 0} pts · ${stats?.fouls ?? 0}/${foulLimit} fouls`}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-ink-dim leading-tight">Tap a player on the court</p>
        )}
      </div>

      <div
        className="flex-1 min-h-0 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={a.run}
            disabled={!has}
            className={`min-h-0 overflow-hidden rounded-md border px-1 text-xs lg:text-sm font-medium leading-tight transition disabled:opacity-30 ${
              a.kind === 'points'
                ? 'border-transparent bg-accent hover:bg-accent-strong text-on-accent font-bold text-sm lg:text-lg'
                : STAT_BTN_COLORS[a.color]
            }`}
          >
            {a.label}
          </button>
        ))}
        <button
          onClick={onOpenSub}
          disabled={!has}
          className="min-h-0 overflow-hidden rounded-md border border-line-strong px-1 text-xs lg:text-sm font-medium leading-tight text-ink hover:bg-panel-alt transition disabled:opacity-30"
        >
          ⇄ Sub
        </button>
      </div>
    </div>
  )
}

/**
 * Top-down full court (28 m x 15 m plus a margin), drawn in real
 * proportions. Logical coordinates: u runs along the length (0..30), v
 * across the width (0..17). In portrait the picture is turned 90 degrees
 * so it fills a tall phone screen. Team A defends the left basket, Team B
 * the right. Basketball has no fixed positions, so each team's five
 * on-court players sit in a simple 2-1-2 formation on their half; a
 * substitute takes over the exact spot of the player they replace.
 */
const COURT_LEN = 30
const COURT_WID = 17
const CHIP = 3
const SPOTS_A = [[3.8, 5.2], [3.8, 11.8], [8.0, 8.5], [12.2, 5.2], [12.2, 11.8]]

function BasketballCourt({ portrait, lineupA, lineupB, playerStats, foulLimit, selected, onSelectPlayer }) {
  const toScreen = (u, v) =>
    portrait ? { x: (COURT_WID - v) / COURT_WID, y: u / COURT_LEN } : { x: u / COURT_LEN, y: v / COURT_WID }
  const chipW = portrait ? CHIP / COURT_WID : CHIP / COURT_LEN
  const chipH = portrait ? CHIP / COURT_LEN : CHIP / COURT_WID
  const ratio = portrait ? COURT_WID / COURT_LEN : COURT_LEN / COURT_WID

  const chips = []
  for (const side of ['A', 'B']) {
    const lineup = side === 'A' ? lineupA : lineupB
    lineup.slice(0, 5).forEach((p, i) => {
      const [ua, v] = SPOTS_A[i]
      const u = side === 'A' ? ua : COURT_LEN - ua
      const { x, y } = toScreen(u, v)
      const s = playerStats[p.id]
      const fouls = s?.fouls ?? 0
      const points = s?.points ?? 0
      const fouledOut = fouls >= foulLimit
      const warning = !fouledOut && fouls === foulLimit - 1
      const isSelected = selected?.team === side && selected.player.id === p.id
      const tone = isSelected
        ? 'bg-accent text-on-accent border-ink'
        : `${fouledOut ? 'bg-live-soft' : warning ? 'bg-warn-soft' : 'bg-page'} text-ink ${TEAM_CLASS[side].border}`
      chips.push(
        <button
          key={p.id}
          type="button"
          title={p.name}
          onClick={() => onSelectPlayer(side, p)}
          className={`absolute flex flex-col items-center justify-center rounded-md leading-none border-2 ${tone}`}
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: `${chipW * 100}%`,
            height: `${chipH * 100}%`,
            transform: 'translate(-50%, -50%)',
            padding: 0,
          }}
        >
          <span style={{ fontSize: portrait ? 'max(11px, 4.4cqw)' : 'max(11px, 2.8cqw)', fontWeight: 700 }}>
            {p.jerseyNumber ?? '--'}
          </span>
          <span
            style={{
              fontSize: portrait ? 'max(8px, 2.6cqw)' : 'max(8px, 1.7cqw)',
              maxWidth: '96%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {p.name}
          </span>
          {fouledOut ? (
            <span className="absolute top-0 right-0 bg-live text-white rounded-bl" style={{ fontSize: 8, padding: '1px 3px' }}>
              OUT
            </span>
          ) : (
            fouls > 0 && (
              <span
                className={`absolute top-0 right-0 rounded-bl ${warning ? 'bg-warn text-on-warn' : 'bg-panel-alt text-ink-dim'}`}
                style={{ fontSize: 8, padding: '1px 3px' }}
              >
                {fouls}F
              </span>
            )
          )}
          {points > 0 && (
            <span className={`absolute bottom-0 right-0 text-on-accent rounded-tl ${TEAM_CLASS[side].bg}`} style={{ fontSize: 8, padding: '1px 3px' }}>
              {points}
            </span>
          )}
        </button>
      )
    })
  }

  // One half of the court (the left one); the right half is the same
  // drawing mirrored. Basket is 1.575 m from the baseline.
  const half = (fillClass) => (
    <>
      <rect x="1" y="6.05" width="5.8" height="4.9" className={fillClass} fillOpacity="0.14" />
      <rect x="1" y="6.05" width="5.8" height="4.9" fill="none" className="stroke-ink-dim" strokeWidth="0.1" />
      <path d="M 6.8 6.7 A 1.8 1.8 0 0 1 6.8 10.3" fill="none" className="stroke-ink-dim" strokeWidth="0.1" />
      <path d="M 6.8 6.7 A 1.8 1.8 0 0 0 6.8 10.3" fill="none" className="stroke-ink-dim" strokeWidth="0.1" strokeDasharray="0.3 0.25" />
      <path d="M 1 1.9 L 3.99 1.9 A 6.75 6.75 0 0 1 3.99 15.1 L 1 15.1" fill="none" className="stroke-ink-dim" strokeWidth="0.1" />
      <line x1="2.2" y1="7.6" x2="2.2" y2="9.4" className="stroke-ink" strokeWidth="0.14" />
      <circle cx="2.575" cy="8.5" r="0.3" fill="none" className="stroke-ink" strokeWidth="0.1" />
    </>
  )

  return (
    <div className="absolute inset-0" style={{ containerType: 'size' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(100cqw, calc(100cqh * ${ratio}))`,
          aspectRatio: `${portrait ? COURT_WID : COURT_LEN} / ${portrait ? COURT_LEN : COURT_WID}`,
          containerType: 'inline-size',
        }}
      >
        <svg
          viewBox={portrait ? `0 0 ${COURT_WID} ${COURT_LEN}` : `0 0 ${COURT_LEN} ${COURT_WID}`}
          className="absolute inset-0 w-full h-full rounded-lg"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g transform={portrait ? `translate(${COURT_WID} 0) rotate(90)` : undefined}>
            <rect x="0" y="0" width="30" height="17" className="fill-panel" />
            <rect x="1" y="1" width="28" height="15" className="fill-panel-alt" />
            <rect x="1" y="1" width="28" height="15" fill="none" className="stroke-ink-dim" strokeWidth="0.12" />
            <line x1="15" y1="1" x2="15" y2="16" className="stroke-ink-dim" strokeWidth="0.1" />
            <circle cx="15" cy="8.5" r="1.8" fill="none" className="stroke-ink-dim" strokeWidth="0.1" />
            <g>{half(TEAM_CLASS.A.fill)}</g>
            <g transform="translate(30 0) scale(-1 1)">{half(TEAM_CLASS.B.fill)}</g>
          </g>
        </svg>
        {chips}
      </div>
    </div>
  )
}

function PotgOverlay({ teamA, teamB, scoreA, scoreB, candidates, playerStats, potgPlayerId, onSelect, onConfirm, onBack, saving, error }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-panel rounded-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold text-ink">Player of the Game</h2>
          <p className="text-xs text-ink-dim mt-0.5">
            Final: {teamA?.name} {scoreA} &middot; {teamB?.name} {scoreB}
          </p>
        </div>

        {error && (
          <div className="mx-3 mt-2 rounded-lg border border-live bg-live-soft px-3 py-2 text-xs text-live">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {candidates.length === 0 && (
            <p className="text-sm text-ink-faint px-2 py-4">
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
                  isSuggested ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-panel-alt'
                }`}
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium text-ink">
                    #{player.jerseyNumber ?? '--'} {player.name}
                  </span>
                  <span className="block text-[11px] text-ink-faint truncate">{teamName}</span>
                </span>
                <span className="text-xs text-ink-dim shrink-0 ml-2">
                  {s.points}p &middot; {s.assists}a &middot; {s.fouls}f &middot; {s.turnovers}to
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-3 py-3 border-t border-line flex gap-2">
          <button
            onClick={onBack}
            className="flex-1 rounded-lg border border-line-strong text-ink-dim font-medium py-2.5 hover:bg-panel-alt transition"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 rounded-lg bg-accent-strong hover:bg-accent text-on-accent font-medium py-2.5 transition disabled:opacity-50"
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
      <div className="bg-panel rounded-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h2 className="font-bold text-ink">Game Log</h2>
          <button onClick={onClose} className="text-xs text-ink-faint hover:text-ink-dim">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {reversed.length === 0 && (
            <p className="text-sm text-ink-faint px-2 py-4">Nothing logged yet.</p>
          )}
          {reversed.map((a) => (
            <div
              key={a.id}
              className={`text-xs px-2 py-1.5 my-0.5 rounded-md ${
                a.type === 'CORRECTION' ? 'bg-warn-soft text-warn' : a.reversed ? 'text-ink-faint line-through' : 'text-ink-dim'
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

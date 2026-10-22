import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, completeMatch, setMatchMvp } from '../../lib/matchesData'
import WinnerBoard from '../tournament/WinnerBoard'
import { pushCloudMatchState, clearMatchState } from '../../lib/liveMatchState'
import { SHOT_CLOCK_MS, POINTS, OT_TARGET, foulPenalty, formatClock, formatShot, gameStatus, suggestMvp } from '../../lib/basketball3x3Rules'
import { TEAM_CLASS } from '../../lib/teamColors'

function lineupKey(matchId) {
  return `basketball3x3-lineup:${matchId}`
}
// The in-progress game is mirrored to this device's storage so a refresh picks up where the scorer left off.
function liveKey(matchId) {
  return `basketball3x3-live:${matchId}`
}
function readLive(matchId) {
  try {
    const raw = localStorage.getItem(liveKey(matchId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function writeLive(matchId, data) {
  try {
    localStorage.setItem(liveKey(matchId), JSON.stringify(data))
  } catch {
    // storage full or blocked -- scoring still works, just without resume
  }
}
function dropLive(matchId) {
  try {
    localStorage.removeItem(liveKey(matchId))
  } catch {
    // ignore
  }
}

const emptyStat = () => ({ points: 0, ones: 0, twos: 0, fts: 0, fouls: 0 })

export default function Basketball3x3MatchSimulate() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [lineupSig, setLineupSig] = useState('')

  // Game state
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [foulsA, setFoulsA] = useState(0)
  const [foulsB, setFoulsB] = useState(0)
  const [timeoutsA, setTimeoutsA] = useState(1)
  const [timeoutsB, setTimeoutsB] = useState(1)
  const [stats, setStats] = useState({}) // playerId -> { points, ones, twos, fts, fouls }
  const [onCourtA, setOnCourtA] = useState([])
  const [onCourtB, setOnCourtB] = useState([])
  const [played, setPlayed] = useState([])
  const [inOT, setInOT] = useState(false)
  const [otStartA, setOtStartA] = useState(0)
  const [otStartB, setOtStartB] = useState(0)
  const [lastPlay, setLastPlay] = useState('')
  const [undoStack, setUndoStack] = useState([])

  // Clocks: remaining time at the last start/stop, and when it was last started (null = stopped).
  const [clockMs, setClockMs] = useState(10 * 60 * 1000)
  const [shotMs, setShotMs] = useState(SHOT_CLOCK_MS)
  const [startedAt, setStartedAt] = useState(null)
  const [now, setNow] = useState(Date.now())

  const [selected, setSelected] = useState(null) // { side, playerId }
  const [subSheet, setSubSheet] = useState(null) // { side, outId }
  const [busy, setBusy] = useState(false)
  const [matchComplete, setMatchComplete] = useState(false)
  const [mvpId, setMvpId] = useState(null)
  const [savingMvp, setSavingMvp] = useState(false)

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
        const gameMs = Number(t.rules?.gameMinutes ?? 10) * 60 * 1000
        const timeouts = Number(t.rules?.timeoutsPerTeam ?? 1)
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

        let saved = null
        try {
          saved = sessionStorage.getItem(lineupKey(matchId))
        } catch {
          // ignore
        }
        const live = readLive(matchId)
        const stale = live && (m.status === 'completed' || (saved && live.sig && live.sig !== saved))
        if (stale) dropLive(matchId)

        if (live && !stale) {
          setLineupSig(live.sig ?? '')
          setScoreA(live.scoreA)
          setScoreB(live.scoreB)
          setFoulsA(live.foulsA)
          setFoulsB(live.foulsB)
          setTimeoutsA(live.timeoutsA)
          setTimeoutsB(live.timeoutsB)
          setStats(live.stats ?? {})
          setOnCourtA(live.onCourtA ?? [])
          setOnCourtB(live.onCourtB ?? [])
          setPlayed(live.played ?? [])
          setInOT(!!live.inOT)
          setOtStartA(live.otStartA ?? 0)
          setOtStartB(live.otStartB ?? 0)
          setLastPlay(live.lastPlay ?? '')
          setUndoStack(live.undoStack ?? [])
          // A refresh pauses the clocks at what was left.
          const elapsed = live.startedAt ? Date.now() - live.startedAt : 0
          setClockMs(Math.max(0, live.clockMs - elapsed))
          setShotMs(Math.max(0, live.shotMs - elapsed))
        } else {
          setClockMs(gameMs)
          setTimeoutsA(timeouts)
          setTimeoutsB(timeouts)
          if (saved) {
            const parsed = JSON.parse(saved)
            setLineupSig(saved)
            setOnCourtA(parsed.idsA ?? [])
            setOnCourtB(parsed.idsB ?? [])
            setPlayed([...(parsed.idsA ?? []), ...(parsed.idsB ?? [])])
          }
        }
        setHydrated(true)
      } catch (err) {
        console.error('Failed to load 3x3 match:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  const target = Number(tournament?.rules?.targetScore ?? 21)

  // Live clock values
  const running = startedAt !== null
  const elapsed = running ? now - startedAt : 0
  const clockLeft = Math.max(0, clockMs - elapsed)
  const shotLeft = Math.max(0, shotMs - elapsed)

  // Tick while running, and stop at zero.
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (running && !inOT && clockLeft <= 0) {
      setClockMs(0)
      setShotMs(0)
      setStartedAt(null)
    }
  }, [running, inOT, clockLeft])

  // How the game stands.
  const { hitTarget, needsOT, ended } = gameStatus({ scoreA, scoreB, target, clockLeftMs: hydrated ? clockLeft : 1, inOT, otStartA, otStartB })
  const winner = scoreA > scoreB ? 'A' : 'B'

  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
  const nameOf = (side) => (side === 'A' ? teamA?.name : teamB?.name) ?? 'TBD'

  // ---------- Resume after refresh ----------
  useEffect(() => {
    if (!hydrated || !match || matchComplete) return
    writeLive(matchId, {
      sig: lineupSig, scoreA, scoreB, foulsA, foulsB, timeoutsA, timeoutsB, stats, onCourtA, onCourtB, played,
      inOT, otStartA, otStartB, lastPlay, undoStack, clockMs, shotMs, startedAt,
    })
  }, [hydrated, match, matchComplete, matchId, lineupSig, scoreA, scoreB, foulsA, foulsB, timeoutsA, timeoutsB, stats, onCourtA, onCourtB, played, inOT, otStartA, otStartB, lastPlay, undoStack, clockMs, shotMs, startedAt])

  // ---------- Live updates for the public watch page ----------
  function pushSnapshot() {
    const t = Date.now()
    const el = startedAt ? t - startedAt : 0
    pushCloudMatchState(matchId, {
      sport: 'basketball3x3',
      target,
      otTarget: OT_TARGET,
      scoreA, scoreB, foulsA, foulsB, timeoutsA, timeoutsB,
      inOT,
      ended,
      clockMs: Math.max(0, clockMs - el),
      clockRunning: running,
      onCourtA, onCourtB,
      stats,
      lastPlay,
    })
  }
  useEffect(() => {
    if (!match || matchComplete || !hydrated || onCourtA.length === 0) return undefined
    const timer = setTimeout(pushSnapshot, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, matchComplete, hydrated, scoreA, scoreB, foulsA, foulsB, timeoutsA, timeoutsB, inOT, ended, running, onCourtA, onCourtB, stats, lastPlay])
  // While the clock runs, re-sync it every 10 seconds so spectators stay close.
  useEffect(() => {
    if (!running || matchComplete) return undefined
    const id = setInterval(pushSnapshot, 10000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, matchComplete, scoreA, scoreB, clockMs, startedAt])

  // ---------- Clock controls ----------
  function commitClocks() {
    // Freeze both clocks at their current value (keeps them running if they were).
    const t = Date.now()
    const el = startedAt ? t - startedAt : 0
    setClockMs(Math.max(0, clockMs - el))
    setShotMs(Math.max(0, shotMs - el))
    if (startedAt) setStartedAt(t)
    setNow(t)
    return { clock: Math.max(0, clockMs - el), shot: Math.max(0, shotMs - el) }
  }
  function toggleClock() {
    if (ended || needsOT || inOT) return
    if (running) {
      commitClocks()
      setStartedAt(null)
    } else if (clockLeft > 0) {
      const t = Date.now()
      setNow(t)
      setStartedAt(t)
    }
  }
  function stopClock() {
    if (!running) return
    commitClocks()
    setStartedAt(null)
  }
  function resetShot() {
    commitClocks()
    setShotMs(SHOT_CLOCK_MS)
  }
  function adjustClock(deltaMs) {
    const c = commitClocks()
    setClockMs(Math.max(0, c.clock + deltaMs))
  }

  // ---------- Undo ----------
  function pushUndo() {
    setUndoStack((s) => [
      ...s.slice(-30),
      { scoreA, scoreB, foulsA, foulsB, timeoutsA, timeoutsB, stats, onCourtA, onCourtB, played, inOT, otStartA, otStartB, lastPlay },
    ])
  }
  function undo() {
    if (undoStack.length === 0 || busy) return
    const p = undoStack[undoStack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setScoreA(p.scoreA); setScoreB(p.scoreB); setFoulsA(p.foulsA); setFoulsB(p.foulsB)
    setTimeoutsA(p.timeoutsA); setTimeoutsB(p.timeoutsB); setStats(p.stats)
    setOnCourtA(p.onCourtA); setOnCourtB(p.onCourtB); setPlayed(p.played)
    setInOT(p.inOT); setOtStartA(p.otStartA); setOtStartB(p.otStartB); setLastPlay(p.lastPlay)
    setSelected(null)
  }

  // ---------- Scoring actions ----------
  function bump(playerId, patch) {
    setStats((prev) => {
      const cur = prev[playerId] ?? emptyStat()
      const next = { ...cur }
      for (const k of Object.keys(patch)) next[k] = (cur[k] ?? 0) + patch[k]
      return { ...prev, [playerId]: next }
    })
  }

  function addPoints(kind) {
    if (!selected || ended || needsOT || busy) return
    const { side, playerId } = selected
    const pts = POINTS[kind]
    pushUndo()
    if (side === 'A') setScoreA((v) => v + pts)
    else setScoreB((v) => v + pts)
    bump(playerId, {
      points: pts,
      ones: kind === 'one' ? 1 : 0,
      twos: kind === 'two' ? 1 : 0,
      fts: kind === 'ft' ? 1 : 0,
    })
    const label = kind === 'two' ? '2-point basket' : kind === 'ft' ? 'free throw' : '1-point basket'
    setLastPlay(`${byId.get(playerId)?.name ?? 'Player'} ${label}`)
    if (kind !== 'ft') resetShot()
    setSelected(null)
  }

  function addFoul() {
    if (!selected || ended || busy) return
    const { side, playerId } = selected
    pushUndo()
    if (side === 'A') setFoulsA((v) => v + 1)
    else setFoulsB((v) => v + 1)
    bump(playerId, { fouls: 1 })
    setLastPlay(`Foul on ${byId.get(playerId)?.name ?? 'player'}`)
    stopClock()
    setSelected(null)
  }

  function callTimeout(side) {
    if (ended || busy) return
    if ((side === 'A' ? timeoutsA : timeoutsB) <= 0) return
    pushUndo()
    if (side === 'A') setTimeoutsA((v) => v - 1)
    else setTimeoutsB((v) => v - 1)
    setLastPlay(`Timeout ${nameOf(side)}`)
    stopClock()
  }

  function substitute(side, outId, inId) {
    pushUndo()
    const swap = (list) => list.map((id) => (id === outId ? inId : id))
    if (side === 'A') setOnCourtA(swap)
    else setOnCourtB(swap)
    setPlayed((prev) => (prev.includes(inId) ? prev : [...prev, inId]))
    setLastPlay(`Sub: ${byId.get(inId)?.name ?? ''} in for ${byId.get(outId)?.name ?? ''}`)
    setSubSheet(null)
    setSelected(null)
  }

  function startOvertime() {
    pushUndo()
    setInOT(true)
    setOtStartA(scoreA)
    setOtStartB(scoreB)
    setLastPlay('Overtime: first to 2 points')
  }

  async function confirmFinal() {
    if (!ended || busy) return
    setBusy(true)
    const playerStats = played.map((id) => {
      const s = stats[id] ?? emptyStat()
      const teamId = rosterA.some((p) => p.id === id) ? teamA?.id : teamB?.id
      return { playerId: id, teamId, points: s.points, fouls: s.fouls, fgMade: s.ones + s.twos }
    })
    try {
      const mvp = suggestMvp(stats, played)
      await completeMatch(matchId, scoreA, scoreB, { playerStats, potgPlayerId: mvp })
      setMvpId(mvp)
      await clearMatchState(matchId)
      dropLive(matchId)
      setMatchComplete(true)
    } catch (err) {
      console.error('Failed to save final result:', err)
      setError(`Could not save the final result: ${err.message ?? 'unknown error'}`)
    }
    setBusy(false)
  }

  // ---------- Render ----------
  if (!match || !tournament) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-ink-dim">
        {error ? <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div> : 'Loading...'}
      </div>
    )
  }

  if (matchComplete) {
    async function pickMvp(playerId) {
      const previous = mvpId
      setMvpId(playerId)
      setSavingMvp(true)
      try {
        await setMatchMvp(matchId, playerId)
        setError('')
      } catch (err) {
        console.error('Failed to save MVP:', err)
        setMvpId(previous)
        setError(`Could not save the MVP: ${err.message ?? 'unknown error'}`)
      }
      setSavingMvp(false)
    }
    const playedIn = (roster) => roster.filter((p) => played.includes(p.id))
    const statTable = (side, roster) => (
      <div key={side} className="rounded-xl border border-line bg-panel/70 overflow-hidden text-left">
        <div className="px-4 py-2 border-b border-line text-sm font-medium text-ink">{nameOf(side)}</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-faint border-b border-line">
              <th className="py-1.5 pl-4 pr-2 text-left font-medium">Player</th>
              <th className="px-2 text-right font-medium">1s</th>
              <th className="px-2 text-right font-medium">2s</th>
              <th className="px-2 text-right font-medium">FT</th>
              <th className="px-2 text-right font-medium">PTS</th>
              <th className="pl-2 pr-4 text-right font-medium">PF</th>
            </tr>
          </thead>
          <tbody>
            {playedIn(roster).map((p) => {
              const s = stats[p.id] ?? emptyStat()
              return (
                <tr key={p.id} className="border-b border-line last:border-0 text-ink-dim">
                  <td className="py-1.5 pl-4 pr-2 text-ink">{p.name}</td>
                  <td className="px-2 text-right tabular-nums">{s.ones}</td>
                  <td className="px-2 text-right tabular-nums">{s.twos}</td>
                  <td className="px-2 text-right tabular-nums">{s.fts}</td>
                  <td className="px-2 text-right tabular-nums font-semibold text-ink">{s.points}</td>
                  <td className="pl-2 pr-4 text-right tabular-nums">{s.fouls}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
    return (
      <WinnerBoard
        sport="basketball3x3"
        kind="team"
        sportLabel="3x3 Basketball"
        tournamentName={tournament?.name}
        winnerName={nameOf(winner)}
        winnerSide={winner}
        nameA={nameOf('A')}
        nameB={nameOf('B')}
        gamesA={scoreA}
        gamesB={scoreB}
        history={inOT ? [{ gameNumber: 'Overtime', scoreA: scoreA - otStartA, scoreB: scoreB - otStartB, winner }] : []}
        unit=""
        playersA={playedIn(rosterA)}
        playersB={playedIn(rosterB)}
        mvpId={mvpId}
        onPickMvp={pickMvp}
        savingMvp={savingMvp}
        error={error}
        onDone={() => { dropLive(matchId); navigate(`/basketball3x3/${tournamentId}/schedule`) }}
      >
        <div className="mt-4 space-y-3">
          {statTable('A', rosterA)}
          {statTable('B', rosterB)}
        </div>
      </WinnerBoard>
    )
  }

  if (onCourtA.length === 0 || onCourtB.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-ink-dim mb-4">Choose the starting three before scoring this game.</p>
        <Link
          to={`/basketball3x3/${tournamentId}/match/${matchId}/lineup`}
          className="inline-block rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition"
        >
          Choose starters
        </Link>
      </div>
    )
  }

  const penaltyA = foulPenalty(foulsB) // team B's fouls give team A free throws
  const penaltyB = foulPenalty(foulsA)

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <Link to={`/basketball3x3/${tournamentId}/schedule`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to schedule
      </Link>
      {error && <div className="mt-3 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>}

      {/* Clocks */}
      <div className="rounded-xl border border-line bg-panel p-4 mt-2 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-center flex-1">
            <p className="text-[11px] font-semibold text-ink-faint uppercase">{inOT ? 'Overtime' : 'Game clock'}</p>
            <p className={`text-5xl font-display font-bold tabular-nums ${clockLeft <= 0 && !inOT ? 'text-live' : 'text-ink'}`}>
              {inOT ? '--' : formatClock(clockLeft)}
            </p>
          </div>
          <div className="text-center w-24">
            <p className="text-[11px] font-semibold text-ink-faint uppercase">Shot clock</p>
            <p className={`text-4xl font-display font-bold tabular-nums ${shotLeft <= 0 ? 'text-live' : shotLeft <= 4000 ? 'text-accent' : 'text-ink'}`}>
              {formatShot(shotLeft)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          <button
            onClick={toggleClock}
            disabled={ended || needsOT || inOT}
            className={`col-span-2 rounded-lg py-2.5 font-medium transition disabled:opacity-40 ${running ? 'bg-live text-white' : 'bg-accent text-on-accent hover:bg-accent-strong'}`}
          >
            {running ? 'Stop clock' : 'Start clock'}
          </button>
          <button onClick={resetShot} className="rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt py-2.5 text-sm font-medium">
            Reset 12
          </button>
          <div className="flex gap-1">
            <button onClick={() => adjustClock(-10000)} disabled={inOT} className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs disabled:opacity-40">-10s</button>
            <button onClick={() => adjustClock(10000)} disabled={inOT} className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs disabled:opacity-40">+10s</button>
          </div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="rounded-xl border border-line bg-panel p-4 mb-3">
        {['A', 'B'].map((side) => {
          const score = side === 'A' ? scoreA : scoreB
          const fouls = side === 'A' ? foulsA : foulsB
          const timeouts = side === 'A' ? timeoutsA : timeoutsB
          const penalty = side === 'A' ? penaltyB : penaltyA // penalty this side's fouls bring on them
          return (
            <div key={side} className="flex items-center justify-between mb-3 last:mb-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
                <span className="min-w-0">
                  <span className="block font-medium text-ink truncate">{nameOf(side)}</span>
                  <span className="block text-xs text-ink-faint">
                    Team fouls {fouls}
                    {penalty && <span className="text-live font-semibold"> · opponents get {penalty.label}</span>}
                    {' · '}Timeouts {timeouts}
                  </span>
                </span>
              </span>
              <span className="text-4xl font-display font-bold text-accent w-16 text-right shrink-0">{score}</span>
            </div>
          )
        })}
        <div className="border-t border-line pt-2 text-center min-h-[2rem]">
          {inOT && !ended && <p className="text-xs font-semibold text-accent">Overtime: first to {OT_TARGET} points wins</p>}
          {!inOT && !ended && !needsOT && <p className="text-xs text-ink-faint">First to {target}, or the higher score when time runs out</p>}
          {needsOT && <p className="text-sm font-semibold text-live">Time is up and the score is tied</p>}
          {ended && <p className="text-sm font-semibold text-accent">{nameOf(winner)} wins {Math.max(scoreA, scoreB)}-{Math.min(scoreA, scoreB)}{hitTarget ? ` (reached ${target})` : ''}</p>}
          {lastPlay && !ended && <p className="text-xs text-ink-dim mt-1">Last: {lastPlay}</p>}
        </div>
      </div>

      {/* Players on court */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {['A', 'B'].map((side) => {
          const onCourt = side === 'A' ? onCourtA : onCourtB
          return (
            <div key={side} className="space-y-2">
              {onCourt.map((id) => {
                const p = byId.get(id)
                const s = stats[id] ?? emptyStat()
                const isSel = selected?.playerId === id
                return (
                  <button
                    key={id}
                    onClick={() => setSelected(isSel ? null : { side, playerId: id })}
                    className={`w-full rounded-lg border-2 px-3 py-2.5 text-left transition ${
                      isSel ? 'border-accent bg-accent-soft' : `${TEAM_CLASS[side].border} bg-panel hover:bg-panel-alt`
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="text-xs text-ink-faint">#{p?.jerseyNumber ?? '--'}</span>
                        <span className="block text-sm text-ink truncate">{p?.name ?? '?'}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-lg font-display font-bold text-ink leading-none">{s.points}</span>
                        <span className="block text-[10px] text-ink-faint">{s.fouls} PF</span>
                      </span>
                    </span>
                  </button>
                )
              })}
              <div className="flex gap-2">
                <button
                  onClick={() => callTimeout(side)}
                  disabled={(side === 'A' ? timeoutsA : timeoutsB) <= 0 || ended}
                  className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt py-1.5 text-xs font-medium disabled:opacity-40"
                >
                  Timeout
                </button>
                <button
                  onClick={() => (selected?.side === side ? setSubSheet({ side, outId: selected.playerId }) : null)}
                  disabled={selected?.side !== side || ended || (side === 'A' ? rosterA : rosterB).length <= onCourt.length}
                  className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt py-1.5 text-xs font-medium disabled:opacity-40"
                >
                  Sub out
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions for the selected player */}
      <p className="text-[11px] text-ink-faint text-center mb-1.5">
        {selected ? `Selected: ${byId.get(selected.playerId)?.name}` : 'Tap a player, then tap what they did'}
      </p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <button onClick={() => addPoints('one')} disabled={!selected || ended || needsOT} className="rounded-lg bg-accent text-on-accent font-bold py-3 disabled:opacity-40">+1<span className="block text-[10px] font-medium">inside</span></button>
        <button onClick={() => addPoints('two')} disabled={!selected || ended || needsOT} className="rounded-lg bg-accent text-on-accent font-bold py-3 disabled:opacity-40">+2<span className="block text-[10px] font-medium">arc</span></button>
        <button onClick={() => addPoints('ft')} disabled={!selected || ended || needsOT} className="rounded-lg border-2 border-accent text-accent font-bold py-3 disabled:opacity-40">FT<span className="block text-[10px] font-medium">+1</span></button>
        <button onClick={addFoul} disabled={!selected || ended} className="rounded-lg border-2 border-live text-live font-bold py-3 disabled:opacity-40">Foul</button>
      </div>

      <div className="flex gap-3">
        <button onClick={undo} disabled={undoStack.length === 0 || busy} className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt py-3 font-medium disabled:opacity-40">
          Undo
        </button>
        {needsOT && (
          <button onClick={startOvertime} className="flex-[2] rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-3 transition">
            Start overtime
          </button>
        )}
        {ended && (
          <button onClick={confirmFinal} disabled={busy} className="flex-[2] rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-3 transition disabled:opacity-50">
            {busy ? 'Saving...' : 'Confirm final score'}
          </button>
        )}
      </div>

      {/* Substitution sheet */}
      {subSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setSubSheet(null)}>
          <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-ink mb-1">Substitution</p>
            <p className="text-xs text-ink-faint mb-3">Who comes in for {byId.get(subSheet.outId)?.name}?</p>
            <div className="space-y-2">
              {(subSheet.side === 'A' ? rosterA : rosterB)
                .filter((p) => !(subSheet.side === 'A' ? onCourtA : onCourtB).includes(p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => substitute(subSheet.side, subSheet.outId, p.id)}
                    className="w-full rounded-lg border-2 border-line-strong hover:bg-panel-alt px-3 py-2.5 text-left text-sm text-ink"
                  >
                    <span className="text-xs text-ink-faint mr-1">#{p.jerseyNumber ?? '--'}</span>
                    {p.name}
                  </button>
                ))}
            </div>
            <button onClick={() => setSubSheet(null)} className="w-full mt-3 text-sm text-ink-faint hover:text-ink-dim">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

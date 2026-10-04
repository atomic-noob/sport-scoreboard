import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, completeMatch } from '../../lib/matchesData'
import { pushCloudMatchState, clearMatchState } from '../../lib/liveMatchState'
import { TEAM_CLASS } from '../../lib/teamColors'
import usePortrait from '../../hooks/usePortrait'
import VolleyballCourt from './VolleyballCourt'
import {
  saveMatchSet,
  saveVolleyballEvents,
  VOLLEYBALL_ACTIONS,
  summarizeEvents,
  hittingPercentage,
  formatHitting,
  deleteVolleyballEventsFrom,
} from '../../lib/volleyballData'

function lineupKey(matchId) {
  return `volleyball-lineup:${matchId}`
}

// The whole in-progress match is mirrored to this device's storage so a
// refresh (or a crash) picks up exactly where the scorer left off.
function liveKey(matchId) {
  return `volleyball-live:${matchId}`
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

/** Shifts a 6-player rotation array one position: the player who was in
 * position 2 becomes the new server (position 1), 3->2, ..., 1->6. This
 * is standard volleyball clockwise rotation. */
function rotate(order) {
  return [...order.slice(1), order[0]]
}

function isSetOver(scoreA, scoreB, target) {
  return (scoreA >= target || scoreB >= target) && Math.abs(scoreA - scoreB) >= 2
}

export default function VolleyballMatchSimulate() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [error, setError] = useState('')
  const portrait = usePortrait()
  const [sheet, setSheet] = useState(null) // null | 'sub' | 'libero'

  const [currentSet, setCurrentSet] = useState(1)
  const [setsWonA, setSetsWonA] = useState(0)
  const [setsWonB, setSetsWonB] = useState(0)
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [setHistory, setSetHistory] = useState([]) // [{setNumber, scoreA, scoreB, winner}]

  const [rotationA, setRotationA] = useState([])
  const [rotationB, setRotationB] = useState([])
  const [servingTeam, setServingTeam] = useState(null) // 'A' | 'B' | null (null = need to pick for this set)

  const [timeoutsA, setTimeoutsA] = useState(0)
  const [timeoutsB, setTimeoutsB] = useState(0)

  // Substitutions: how many used this set, and everyone who has been on court this match
  const [subsUsedA, setSubsUsedA] = useState(0)
  const [subsUsedB, setSubsUsedB] = useState(0)
  const [playedA, setPlayedA] = useState([])
  const [playedB, setPlayedB] = useState([])

  // Libero: the chosen libero per team, and (while on court) which player they replaced
  const [liberoA, setLiberoA] = useState(null)
  const [liberoB, setLiberoB] = useState(null)
  const [liberoForA, setLiberoForA] = useState(null)
  const [liberoForB, setLiberoForB] = useState(null)

  // Phase 2: per-player actions
  const [selected, setSelected] = useState(null) // { side: 'A' | 'B', playerId }
  const [setEvents, setSetEvents] = useState([]) // events in the set being played
  const [matchEvents, setMatchEvents] = useState([]) // events from confirmed sets (with seq)
  const [unsavedEvents, setUnsavedEvents] = useState([]) // confirmed events not yet saved to Supabase
  const [undoStack, setUndoStack] = useState([]) // snapshots, cleared when a set is confirmed
  const [setOver, setSetOver] = useState(false) // a set has reached its end and awaits confirmation
  const [busy, setBusy] = useState(false)

  // Starting six for each team: every new set begins from these (editable between sets)
  const [startA, setStartA] = useState([])
  const [startB, setStartB] = useState([])
  const [lastSetSnapshot, setLastSetSnapshot] = useState(null) // lets the scorer reopen the set just confirmed
  const [notice, setNotice] = useState('') // "Switch sides" / "Technical timeout"
  const [hydrated, setHydrated] = useState(false)
  const [lineupSig, setLineupSig] = useState('')

  const [matchComplete, setMatchComplete] = useState(false)
  const [matchWinner, setMatchWinner] = useState(null)
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
        setMatch(m)
        setTimeoutsA(t.rules?.timeoutsPerSet ?? 2)
        setTimeoutsB(t.rules?.timeoutsPerSet ?? 2)

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
        const live = readLive(matchId)
        // A different lineup was entered after the saved state (lineup setup run
        // again) or the match is already finished: start fresh instead.
        const stale = live && (m.status === 'completed' || (saved && live.sig && live.sig !== saved))
        if (stale) dropLive(matchId)

        if (live && !stale) {
          setLineupSig(live.sig ?? '')
          setCurrentSet(live.currentSet)
          setSetsWonA(live.setsWonA)
          setSetsWonB(live.setsWonB)
          setScoreA(live.scoreA)
          setScoreB(live.scoreB)
          setSetHistory(live.setHistory ?? [])
          setRotationA(live.rotationA ?? [])
          setRotationB(live.rotationB ?? [])
          setServingTeam(live.servingTeam ?? null)
          setTimeoutsA(live.timeoutsA)
          setTimeoutsB(live.timeoutsB)
          setSubsUsedA(live.subsUsedA ?? 0)
          setSubsUsedB(live.subsUsedB ?? 0)
          setPlayedA(live.playedA ?? [])
          setPlayedB(live.playedB ?? [])
          setLiberoA(live.liberoA ?? null)
          setLiberoB(live.liberoB ?? null)
          setLiberoForA(live.liberoForA ?? null)
          setLiberoForB(live.liberoForB ?? null)
          setSetEvents(live.setEvents ?? [])
          setMatchEvents(live.matchEvents ?? [])
          setUnsavedEvents(live.unsavedEvents ?? [])
          setUndoStack(live.undoStack ?? [])
          setSetOver(!!live.setOver)
          setStartA(live.startA ?? [])
          setStartB(live.startB ?? [])
          setLastSetSnapshot(live.lastSetSnapshot ?? null)
        } else if (saved) {
          const parsed = JSON.parse(saved)
          setLineupSig(saved)
          setRotationA(parsed.orderA ?? [])
          setRotationB(parsed.orderB ?? [])
          setStartA(parsed.orderA ?? [])
          setStartB(parsed.orderB ?? [])
          setPlayedA(parsed.orderA ?? [])
          setPlayedB(parsed.orderB ?? [])
        }
        setHydrated(true)
      } catch (err) {
        console.error('Failed to load volleyball match:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  const setsToWin = tournament?.rules?.setsToWin ?? 3
  const pointsPerSet = tournament?.rules?.pointsPerSet ?? 25
  const deciderSetPoints = tournament?.rules?.deciderSetPoints ?? 15
  const decidingSetNumber = setsToWin * 2 - 1
  const subsPerSet = Number(tournament?.rules?.subsPerSet ?? 6)
  const technicalTimeout = Number(tournament?.rules?.technicalTimeout ?? 0) === 1
  const target = currentSet === decidingSetNumber ? deciderSetPoints : pointsPerSet

  // ---------- Resume after refresh ----------
  useEffect(() => {
    if (!hydrated || !match || matchComplete) return
    writeLive(matchId, {
      sig: lineupSig, currentSet, setsWonA, setsWonB, scoreA, scoreB, setHistory, rotationA, rotationB,
      servingTeam, timeoutsA, timeoutsB, subsUsedA, subsUsedB, playedA, playedB, liberoA, liberoB,
      liberoForA, liberoForB, setEvents, matchEvents, unsavedEvents, undoStack, setOver, startA, startB,
      lastSetSnapshot,
    })
  }, [
    hydrated, match, matchComplete, lineupSig, currentSet, setsWonA, setsWonB, scoreA, scoreB, setHistory,
    rotationA, rotationB, servingTeam, timeoutsA, timeoutsB, subsUsedA, subsUsedB, playedA, playedB,
    liberoA, liberoB, liberoForA, liberoForB, setEvents, matchEvents, unsavedEvents, undoStack, setOver,
    startA, startB, lastSetSnapshot,
  ])

  // ---------- Live updates for the public watch page ----------
  // Sends a small snapshot of the match to Supabase a moment after anything
  // changes, so spectators on /watch see the score, set results, rotation
  // and stats. Only the scorer's device writes this; it is deleted when the
  // match completes.
  useEffect(() => {
    if (!match || matchComplete || servingTeam === null) return undefined
    const timer = setTimeout(() => {
      pushCloudMatchState(matchId, {
        sport: 'volleyball',
        currentSet,
        target,
        scoreA,
        scoreB,
        setsWonA,
        setsWonB,
        setHistory,
        servingTeam,
        rotationA,
        rotationB,
        liberoA,
        liberoB,
        setOver,
        events: [...matchEvents, ...setEvents],
        playedA,
        playedB,
      })
    }, 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    match, matchComplete, servingTeam, currentSet, scoreA, scoreB, setsWonA, setsWonB, setHistory,
    rotationA, rotationB, liberoA, liberoB, setOver, matchEvents, setEvents, playedA, playedB,
  ])

  // ---------- Undo support ----------

  function takeSnapshot() {
    return {
      scoreA, scoreB, servingTeam, rotationA, rotationB, timeoutsA, timeoutsB, setEvents, setOver,
      subsUsedA, subsUsedB, playedA, playedB, liberoForA, liberoForB, selected,
    }
  }

  function pushUndo() {
    setUndoStack((stack) => [...stack, takeSnapshot()])
  }

  function undoLast() {
    if (busy || undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setScoreA(last.scoreA)
    setScoreB(last.scoreB)
    setServingTeam(last.servingTeam)
    setRotationA(last.rotationA)
    setRotationB(last.rotationB)
    setTimeoutsA(last.timeoutsA)
    setTimeoutsB(last.timeoutsB)
    setSetEvents(last.setEvents)
    setSetOver(last.setOver)
    setSubsUsedA(last.subsUsedA)
    setSubsUsedB(last.subsUsedB)
    setPlayedA(last.playedA)
    setPlayedB(last.playedB)
    setLiberoForA(last.liberoForA)
    setLiberoForB(last.liberoForB)
    setSelected(last.selected)
    setNotice('')
    setUndoStack(undoStack.slice(0, -1))
  }

  // ---------- Scoring ----------

  /** Rotates one team. The libero may not play front row, so if the rotation
   * would move them into position 4 they swap back out for the player they replaced. */
  function rotateTeam(side) {
    const current = side === 'A' ? rotationA : rotationB
    const libero = side === 'A' ? liberoA : liberoB
    const forId = side === 'A' ? liberoForA : liberoForB
    const next = rotate(current)
    if (libero && forId && next[3] === libero) {
      next[3] = forId
      if (side === 'A') setLiberoForA(null)
      else setLiberoForB(null)
      if (selected?.side === side && selected.playerId === libero) setSelected({ side, playerId: forId })
    }
    if (side === 'A') setRotationA(next)
    else setRotationB(next)
  }

  /** Gives `side` one point, handling side-out rotation and set end. */
  function scorePoint(side) {
    const newScoreA = side === 'A' ? scoreA + 1 : scoreA
    const newScoreB = side === 'B' ? scoreB + 1 : scoreB
    setScoreA(newScoreA)
    setScoreB(newScoreB)

    if (side !== servingTeam) {
      // Side-out: the team that just scored gains serve and rotates.
      rotateTeam(side)
      setServingTeam(side)
    }

    if (isSetOver(newScoreA, newScoreB, target)) {
      setSetOver(true)
    } else {
      // Mid-set reminders: the deciding set switches sides at the halfway point;
      // other sets can optionally have technical timeouts at 8 and 16.
      const before = Math.max(scoreA, scoreB)
      const after = Math.max(newScoreA, newScoreB)
      const half = Math.ceil(target / 2)
      if (currentSet === decidingSetNumber) {
        if (before < half && after >= half) setNotice(`Switch sides — a team reached ${half}`)
      } else if (technicalTimeout) {
        const hit = [8, 16].find((pt) => before < pt && after >= pt && target > pt)
        if (hit) setNotice(`Technical timeout — a team reached ${hit}`)
      }
    }
  }

  function canScore() {
    return !busy && !setOver && !matchComplete && servingTeam !== null
  }

  /** A point with no player attached (e.g. an error you aren't tracking). */
  function addPlainPoint(side) {
    if (!canScore()) return
    pushUndo()
    scorePoint(side)
  }

  function performAction(def) {
    if (!canScore() || !selected) return
    const { side, playerId } = selected
    const actingTeam = side === 'A' ? teamA : teamB
    const pointSide = def.point === 'self' ? side : def.point === 'opponent' ? (side === 'A' ? 'B' : 'A') : null
    const pointTeam = pointSide === 'A' ? teamA : pointSide === 'B' ? teamB : null

    pushUndo()
    setSetEvents((prev) => [
      ...prev,
      {
        setNumber: currentSet,
        teamId: actingTeam?.id ?? null,
        playerId,
        action: def.key,
        pointTeamId: pointTeam?.id ?? null,
      },
    ])
    if (pointSide) scorePoint(pointSide)
    // The player stays selected so the scorer can log several actions in a row.
  }

  /** Swaps a player on court for one from the bench, in the same rotation spot. */
  function substitute(side, outId, inId) {
    if (busy || setOver || matchComplete) return
    const used = side === 'A' ? subsUsedA : subsUsedB
    if (used >= subsPerSet) return
    if (outId === (side === 'A' ? liberoA : liberoB)) return // the libero swaps via Libero out

    pushUndo()
    const swap = (order) => order.map((id) => (id === outId ? inId : id))
    const addPlayed = (played) => (played.includes(inId) ? played : [...played, inId])
    if (side === 'A') {
      setRotationA(swap)
      setSubsUsedA((n) => n + 1)
      setPlayedA(addPlayed)
    } else {
      setRotationB(swap)
      setSubsUsedB((n) => n + 1)
      setPlayedB(addPlayed)
    }
    // The new player takes over the selection so the scorer can keep going.
    setSelected({ side, playerId: inId })
  }

  /** Picks (or clears) a team's libero. Only possible while the libero is off court. */
  function chooseLibero(side, id) {
    const rotation = side === 'A' ? rotationA : rotationB
    const current = side === 'A' ? liberoA : liberoB
    if (current && rotation.includes(current)) return
    if (id && rotation.includes(id)) return
    if (side === 'A') setLiberoA(id || null)
    else setLiberoB(id || null)
  }

  /** The libero replaces a back-row player (position 5 or 6). Not counted as a substitution. */
  function liberoIn(side, outId) {
    if (busy || setOver || matchComplete) return
    const rotation = side === 'A' ? rotationA : rotationB
    const libero = side === 'A' ? liberoA : liberoB
    if (!libero || rotation.includes(libero)) return
    const idx = rotation.indexOf(outId)
    if (idx !== 4 && idx !== 5) return
    pushUndo()
    const swap = (order) => order.map((id) => (id === outId ? libero : id))
    const addPlayed = (played) => (played.includes(libero) ? played : [...played, libero])
    if (side === 'A') {
      setRotationA(swap)
      setLiberoForA(outId)
      setPlayedA(addPlayed)
    } else {
      setRotationB(swap)
      setLiberoForB(outId)
      setPlayedB(addPlayed)
    }
    setSelected({ side, playerId: libero })
  }

  /** The libero leaves and the player they replaced comes back to the same spot. */
  function liberoOut(side) {
    if (busy || setOver || matchComplete) return
    const rotation = side === 'A' ? rotationA : rotationB
    const libero = side === 'A' ? liberoA : liberoB
    const forId = side === 'A' ? liberoForA : liberoForB
    if (!libero || !forId || !rotation.includes(libero)) return
    pushUndo()
    const swap = (order) => order.map((id) => (id === libero ? forId : id))
    if (side === 'A') {
      setRotationA(swap)
      setLiberoForA(null)
    } else {
      setRotationB(swap)
      setLiberoForB(null)
    }
    setSelected({ side, playerId: forId })
  }

  function callTimeout(side) {
    if (!canScore()) return
    pushUndo()
    if (side === 'A') setTimeoutsA((t) => Math.max(0, t - 1))
    else setTimeoutsB((t) => Math.max(0, t - 1))
  }

  // ---------- Finishing a set / the match ----------

  async function saveEvents(events) {
    try {
      await saveVolleyballEvents(matchId, events)
      setUnsavedEvents([])
      return true
    } catch (err) {
      console.error('Could not save player stats (will retry):', err)
      setUnsavedEvents(events)
      return false
    }
  }

  async function confirmSet() {
    if (!setOver || busy) return
    setBusy(true)

    const winner = scoreA > scoreB ? 'A' : 'B'
    // Everything needed to reopen this set if the scorer confirmed too early.
    const reopenSnapshot = {
      currentSet, scoreA, scoreB, servingTeam, rotationA, rotationB, timeoutsA, timeoutsB, subsUsedA, subsUsedB,
      playedA, playedB, liberoForA, liberoForB, setEvents, undoStack, winner, matchEventsLen: matchEvents.length,
      startA, startB,
    }
    const winnerTeamId = winner === 'A' ? teamA?.id : teamB?.id
    setSetHistory((prev) => [...prev, { setNumber: currentSet, scoreA, scoreB, winner }])

    try {
      await saveMatchSet(matchId, currentSet, scoreA, scoreB, winnerTeamId)
    } catch (err) {
      console.error('Could not save set result (will still continue locally):', err)
    }

    // Number this set's events after everything already confirmed, then save.
    const base = matchEvents.length
    const numbered = setEvents.map((e, i) => ({ ...e, seq: base + i }))
    setMatchEvents((prev) => [...prev, ...numbered])
    await saveEvents([...unsavedEvents, ...numbered])

    const newSetsWonA = winner === 'A' ? setsWonA + 1 : setsWonA
    const newSetsWonB = winner === 'B' ? setsWonB + 1 : setsWonB
    setSetsWonA(newSetsWonA)
    setSetsWonB(newSetsWonB)

    if (newSetsWonA >= setsToWin || newSetsWonB >= setsToWin) {
      setMatchComplete(true)
      setMatchWinner(newSetsWonA > newSetsWonB ? 'A' : 'B')
      setSaving(true)
      try {
        await completeMatch(matchId, newSetsWonA, newSetsWonB)
        await clearMatchState(matchId) // spectators now read the saved result instead
        dropLive(matchId)
      } catch (err) {
        console.error('Failed to save final match result:', err)
        setError(`Could not save the final result: ${err.message ?? 'unknown error'}`)
      } finally {
        setSaving(false)
        setBusy(false)
      }
      return
    }

    // Next set: reset the score, timeouts and subs, and start from each team's
    // starting six again (the scorer can change them on the next screen).
    // Who serves first is picked again.
    setLastSetSnapshot(reopenSnapshot)
    if (startA.length === 6) setRotationA(startA)
    if (startB.length === 6) setRotationB(startB)
    setLiberoForA(null)
    setLiberoForB(null)
    setNotice('')
    setCurrentSet((s) => s + 1)
    setScoreA(0)
    setScoreB(0)
    setTimeoutsA(tournament?.rules?.timeoutsPerSet ?? 2)
    setTimeoutsB(tournament?.rules?.timeoutsPerSet ?? 2)
    setServingTeam(null)
    setSetEvents([])
    setUndoStack([])
    setSelected(null)
    setSubsUsedA(0)
    setSubsUsedB(0)
    setSetOver(false)
    setBusy(false)
  }

  /** Goes back into the set that was just confirmed (before the next one is started). */
  async function reopenLastSet() {
    const snap = lastSetSnapshot
    if (!snap || busy || matchComplete) return
    setBusy(true)
    setCurrentSet(snap.currentSet)
    setScoreA(snap.scoreA)
    setScoreB(snap.scoreB)
    setServingTeam(snap.servingTeam)
    setRotationA(snap.rotationA)
    setRotationB(snap.rotationB)
    setTimeoutsA(snap.timeoutsA)
    setTimeoutsB(snap.timeoutsB)
    setSubsUsedA(snap.subsUsedA)
    setSubsUsedB(snap.subsUsedB)
    setPlayedA(snap.playedA)
    setPlayedB(snap.playedB)
    setLiberoForA(snap.liberoForA)
    setLiberoForB(snap.liberoForB)
    setSetEvents(snap.setEvents)
    setUndoStack(snap.undoStack)
    setStartA(snap.startA)
    setStartB(snap.startB)
    setSetOver(true)
    setSelected(null)
    setNotice('')
    setSetHistory((prev) => prev.slice(0, -1))
    if (snap.winner === 'A') setSetsWonA((n) => Math.max(0, n - 1))
    else setSetsWonB((n) => Math.max(0, n - 1))
    setMatchEvents((prev) => prev.slice(0, snap.matchEventsLen))
    setUnsavedEvents((prev) => prev.filter((e) => e.seq < snap.matchEventsLen))
    setLastSetSnapshot(null)
    try {
      // Re-confirming will upsert the set and its events again; remove the old events first.
      await deleteVolleyballEventsFrom(matchId, snap.matchEventsLen)
    } catch (err) {
      console.warn('Could not clear the old set events (will be overwritten on confirm):', err)
    }
    setBusy(false)
  }

  /** Saves a new starting six for both teams (used between sets). */
  function applyLineup(orderA, orderB) {
    setRotationA(orderA)
    setRotationB(orderB)
    setStartA(orderA)
    setStartB(orderB)
    setPlayedA((p) => [...new Set([...p, ...orderA])])
    setPlayedB((p) => [...new Set([...p, ...orderB])])
    setSheet(null)
  }

  async function retrySaveStats() {
    setSaving(true)
    const ok = await saveEvents(unsavedEvents)
    setSaving(false)
    if (!ok) setError('Still could not save the player stats. Check your connection and try again.')
    else setError('')
  }

  function handleDone() {
    dropLive(matchId)
    navigate(`/volleyball/${tournamentId}/schedule`)
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
    return (
      <div className="max-w-3xl lg:max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold text-accent uppercase mb-2">Match Complete</p>
          <h1 className="text-2xl font-display font-bold tracking-wide text-ink mb-1">
            {matchWinner === 'A' ? teamA?.name : teamB?.name} wins
          </h1>
          <p className="text-ink-dim mb-3">{setsWonA} - {setsWonB} in sets</p>
          <div className="space-y-1">
            {setHistory.map((s) => (
              <p key={s.setNumber} className="text-sm text-ink-dim">
                Set {s.setNumber}: {s.scoreA} - {s.scoreB}
              </p>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        )}

        {unsavedEvents.length > 0 && (
          <div className="mb-4 rounded-lg border border-warn bg-warn-soft p-3 text-center">
            <p className="text-sm text-warn mb-2">
              Player stats for this match haven't been saved yet.
            </p>
            <button
              onClick={retrySaveStats}
              disabled={saving}
              className="text-xs font-medium bg-warn text-on-warn rounded-md px-3 py-1.5 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Retry saving stats'}
            </button>
          </div>
        )}

        <div className="space-y-4 mb-8">
          <BoxScore team={teamA} roster={rosterA} lineup={playedA} events={matchEvents} liberoId={liberoA} />
          <BoxScore team={teamB} roster={rosterB} lineup={playedB} events={matchEvents} liberoId={liberoB} />
        </div>

        <div className="text-center flex items-center justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt font-medium px-6 py-3 transition"
          >
            Print summary
          </button>
          <button
            onClick={handleDone}
            disabled={saving}
            className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </div>
      </div>
    )
  }

  const setTallies = summarizeEvents(setEvents)
  const lastEvent = setEvents[setEvents.length - 1]
  const lastLabel = lastEvent
    ? `${VOLLEYBALL_ACTIONS.find((a) => a.key === lastEvent.action)?.label ?? lastEvent.action}`
    : null
  const scheduleLink = `/volleyball/${tournamentId}/schedule`
  const locked = setOver || busy

  const undoButton = (
    <button
      onClick={undoLast}
      disabled={undoStack.length === 0 || busy}
      className="text-xs rounded-md border border-line-strong text-ink-dim hover:bg-panel-alt px-2.5 py-1 transition disabled:opacity-30 shrink-0"
    >
      ↶ Undo{lastLabel ? ` (${lastLabel})` : ''}
    </button>
  )

  // ---------- Before the set starts: who serves first ----------
  if (servingTeam === null) {
    return (
      <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Link to={scheduleLink} className="text-sm text-ink-faint hover:text-ink-dim">
          ← Back to schedule
        </Link>
        {error && (
          <div className="mt-3 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        )}
        <div className="flex items-center justify-between mt-3 mb-4">
          <p className="text-xs font-semibold text-ink-faint uppercase">
            Set {currentSet} {currentSet === decidingSetNumber && '(deciding set)'} · first to {target}
          </p>
          {lastSetSnapshot ? (
            <button
              onClick={reopenLastSet}
              disabled={busy}
              className="text-xs rounded-md border border-line-strong text-ink-dim hover:bg-panel-alt px-2.5 py-1 transition disabled:opacity-30 shrink-0"
            >
              ↶ Reopen set {lastSetSnapshot.currentSet}
            </button>
          ) : (
            undoButton
          )}
        </div>
        <div className="rounded-xl border border-line bg-panel p-6 text-center max-w-sm mx-auto">
          <p className="text-ink font-medium mb-4">Who serves first this set?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setServingTeam('A')}
              className="flex-1 rounded-lg border border-line-strong hover:border-accent hover:bg-accent-soft text-ink font-medium py-3 transition"
            >
              {teamA?.name}
            </button>
            <button
              onClick={() => setServingTeam('B')}
              className="flex-1 rounded-lg border border-line-strong hover:border-accent hover:bg-accent-soft text-ink font-medium py-3 transition"
            >
              {teamB?.name}
            </button>
          </div>
          <button
            onClick={() => setSheet('lineup')}
            className="mt-4 text-sm font-medium text-accent hover:text-accent-strong"
          >
            Change starting lineup
          </button>
        </div>
        {sheet === 'lineup' && (
          <Sheet title="Starting lineup" onClose={() => setSheet(null)}>
            <LineupEditor
              teamA={teamA} teamB={teamB} rosterA={rosterA} rosterB={rosterB}
              orderA={rotationA} orderB={rotationB} liberoA={liberoA} liberoB={liberoB}
              onSave={applyLineup}
            />
          </Sheet>
        )}
      </div>
    )
  }

  // ---------- Playing: one full-screen layout, no scrolling ----------
  const teamInfo = (side) => ({
    team: side === 'A' ? teamA : teamB,
    roster: side === 'A' ? rosterA : rosterB,
    rotation: side === 'A' ? rotationA : rotationB,
    libero: side === 'A' ? liberoA : liberoB,
    liberoFor: side === 'A' ? liberoForA : liberoForB,
    subsUsed: side === 'A' ? subsUsedA : subsUsedB,
  })
  const selSide = selected?.side ?? null
  const sel = selSide ? teamInfo(selSide) : null
  const selectedPlayer = sel ? sel.roster.find((p) => p.id === selected.playerId) : null
  const selectedIndex = sel ? sel.rotation.indexOf(selected.playerId) : -1
  const selectedIsServer = !!sel && selSide === servingTeam && selectedIndex === 0
  const selectedIsLibero = !!sel && selected.playerId === sel.libero
  const subsLeft = sel ? Math.max(0, subsPerSet - sel.subsUsed) : 0
  const bench = sel
    ? sel.roster.filter((p) => !sel.rotation.includes(p.id) && p.id !== sel.libero && p.id !== sel.liberoFor)
    : []
  const liberoOnCourt = !!sel?.libero && sel.rotation.includes(sel.libero)
  const liberoCandidates = sel ? sel.roster.filter((p) => !sel.rotation.includes(p.id) && p.id !== sel.liberoFor) : []
  const canLiberoIn = !!sel?.libero && !liberoOnCourt && (selectedIndex === 4 || selectedIndex === 5)

  const server = teamInfo(servingTeam)
  const serverPlayer = server.roster.find((p) => p.id === server.rotation[0])

  return (
    <div className="fixed inset-0 z-40 bg-page flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-line">
        <Link to={scheduleLink} className="text-xs text-ink-faint hover:text-ink-dim shrink-0">
          ← Schedule
        </Link>
        <p className="text-[11px] font-semibold text-ink-faint uppercase truncate">
          Set {currentSet}
          {currentSet === decidingSetNumber ? ' (deciding)' : ''} · first to {target}
        </p>
        {undoButton}
      </div>
      {error && <div className="shrink-0 bg-live-soft px-3 py-1 text-xs text-live">{error}</div>}

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '3fr 1fr' }}>
        <div className="min-w-0 min-h-0 flex flex-col gap-2 p-2">
          <Scoreboard
            portrait={portrait}
            teamA={teamA}
            teamB={teamB}
            scoreA={scoreA}
            scoreB={scoreB}
            setsWonA={setsWonA}
            setsWonB={setsWonB}
            timeoutsA={timeoutsA}
            timeoutsB={timeoutsB}
            locked={locked}
            setHistory={setHistory}
            servingTeam={servingTeam}
            serverPlayer={serverPlayer}
            serverTeam={server.team}
            onPlainPoint={addPlainPoint}
            onTimeout={callTimeout}
          />
          <div className="flex-1 min-h-0 relative">
            <VolleyballCourt
              portrait={portrait}
              rotationA={rotationA}
              rotationB={rotationB}
              rosterA={rosterA}
              rosterB={rosterB}
              servingTeam={servingTeam}
              liberoA={liberoA}
              liberoB={liberoB}
              selected={selected}
              locked={locked}
              tallies={setTallies}
              onSelectPlayer={(side, id) =>
                setSelected(selected?.side === side && selected.playerId === id ? null : { side, playerId: id })
              }
            />
            {notice && !setOver && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg border border-warn bg-warn-soft px-3 py-1.5 shadow">
                <span className="text-xs font-medium text-warn">{notice}</span>
                <button onClick={() => setNotice('')} className="text-[11px] rounded border border-warn text-warn px-1.5 py-0.5">
                  OK
                </button>
              </div>
            )}
            {setOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-xl p-3">
                <div className="rounded-xl border border-accent bg-panel p-4 text-center max-w-xs">
                  <p className="text-sm font-medium text-ink mb-1">
                    Set {currentSet} is over: {scoreA} - {scoreB}
                  </p>
                  <p className="text-xs text-ink-dim mb-3">Wrong? Use Undo. Otherwise confirm to save the set.</p>
                  <button
                    onClick={confirmSet}
                    disabled={busy}
                    className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-5 py-2 text-sm transition disabled:opacity-50"
                  >
                    {busy ? 'Saving...' : `Confirm set ${currentSet}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <ActionColumn
          portrait={portrait}
          side={selSide}
          teamName={sel?.team?.name}
          playerName={selectedPlayer?.name}
          locked={locked}
          hasSelection={!!selected}
          selectedIsServer={selectedIsServer}
          selectedIsLibero={selectedIsLibero}
          liberoOnCourt={liberoOnCourt}
          hasLibero={!!sel?.libero}
          onAction={performAction}
          onOpenSub={() => setSheet('sub')}
          onOpenLibero={() => setSheet('libero')}
        />
      </div>

      {sheet === 'sub' && sel && (
        <Sheet title={`Substitute · ${sel.team?.name ?? ''}`} onClose={() => setSheet(null)}>
          {selectedIsLibero ? (
            <p className="text-sm text-ink-dim">The libero can't be substituted. Use the Libero button to take them out.</p>
          ) : (
            <>
              <p className="text-sm text-ink-dim mb-1">
                Replace <span className="font-medium text-ink">{selectedPlayer?.name ?? 'player'}</span> with:
              </p>
              <p className="text-xs text-ink-faint mb-3">
                {subsLeft} sub{subsLeft === 1 ? '' : 's'} left this set
              </p>
              {subsLeft <= 0 ? (
                <p className="text-sm text-warn">No substitutions left this set.</p>
              ) : bench.length === 0 ? (
                <p className="text-sm text-ink-dim">No bench players available.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {bench.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        substitute(selSide, selected.playerId, p.id)
                        setSheet(null)
                      }}
                      className="rounded-md border border-line-strong px-2 py-3 text-sm text-ink hover:border-accent hover:bg-accent-soft transition text-left truncate"
                    >
                      {p.jerseyNumber ? <span className="text-ink-faint">#{p.jerseyNumber} </span> : null}
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Sheet>
      )}

      {sheet === 'libero' && sel && (
        <Sheet title={`Libero · ${sel.team?.name ?? ''}`} onClose={() => setSheet(null)}>
          <p className="text-xs text-ink-faint mb-3">
            The libero replaces a back-row player (position 5 or 6) and is not a substitution. They go out
            automatically before reaching the front row.
          </p>

          <p className="text-xs font-semibold text-ink-faint uppercase mb-1.5">Choose the libero</p>
          {liberoOnCourt ? (
            <p className="text-sm text-ink-dim mb-3">
              {sel.roster.find((p) => p.id === sel.libero)?.name ?? 'The libero'} is on court. Take them out to change.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => chooseLibero(selSide, '')}
                className={`rounded-md border px-2 py-2.5 text-sm text-left transition ${
                  !sel.libero ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong text-ink-dim hover:bg-panel-alt'
                }`}
              >
                None
              </button>
              {liberoCandidates.map((p) => (
                <button
                  key={p.id}
                  onClick={() => chooseLibero(selSide, p.id)}
                  className={`rounded-md border px-2 py-2.5 text-sm text-left truncate transition ${
                    sel.libero === p.id ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong text-ink hover:bg-panel-alt'
                  }`}
                >
                  {p.jerseyNumber ? <span className="text-ink-faint">#{p.jerseyNumber} </span> : null}
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {!liberoOnCourt && liberoCandidates.length === 0 && (
            <p className="text-xs text-ink-faint mb-3">Everyone is in the starting six. Leave one player out of the lineup to use as libero.</p>
          )}

          {liberoOnCourt ? (
            <button
              onClick={() => {
                liberoOut(selSide)
                setSheet(null)
              }}
              className="w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 text-sm transition"
            >
              Libero out
            </button>
          ) : (
            <button
              onClick={() => {
                liberoIn(selSide, selected.playerId)
                setSheet(null)
              }}
              disabled={!canLiberoIn}
              className="w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 text-sm transition disabled:opacity-30"
            >
              {canLiberoIn
                ? `Libero in for ${selectedPlayer?.name ?? 'player'}`
                : sel.libero
                  ? 'Select a back-row player (position 5 or 6) first'
                  : 'Choose a libero first'}
            </button>
          )}
        </Sheet>
      )}
    </div>
  )
}

const SHORT_LABELS = { attack: 'Attack', attack_error: 'Atk error', service_error: 'Srv error' }
const LIBERO_BLOCKED = ['kill', 'attack', 'attack_error', 'block']

/** Simple modal used for the substitute and libero pickers. */
/** Pick the starting six for both teams. Position 1 is the server. */
function LineupEditor({ teamA, teamB, rosterA, rosterB, orderA, orderB, liberoA, liberoB, onSave }) {
  const pad = (order) => Array.from({ length: 6 }, (_, i) => order[i] ?? '')
  const [draftA, setDraftA] = useState(pad(orderA))
  const [draftB, setDraftB] = useState(pad(orderB))
  const valid = (d) => d.every(Boolean) && new Set(d).size === 6

  const column = (team, roster, draft, setDraft, libero) => (
    <div>
      <p className="text-xs font-semibold text-ink-faint uppercase mb-1.5 truncate">{team?.name ?? 'Team'}</p>
      <div className="space-y-1.5">
        {draft.map((id, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-6 text-[11px] text-ink-faint shrink-0">P{i + 1}</span>
            <select
              value={id}
              onChange={(e) => setDraft(draft.map((d, j) => (j === i ? e.target.value : d)))}
              className="min-w-0 flex-1 rounded-md border border-line-strong bg-panel-alt px-1.5 py-1.5 text-xs text-ink"
            >
              <option value="">Choose…</option>
              {roster
                .filter((p) => p.id !== libero && (p.id === id || !draft.includes(p.id)))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.jerseyNumber ? `#${p.jerseyNumber} ` : ''}
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <p className="text-xs text-ink-faint mb-3">P1 is the first server. The libero is not part of the starting six.</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {column(teamA, rosterA, draftA, setDraftA, liberoA)}
        {column(teamB, rosterB, draftB, setDraftB, liberoB)}
      </div>
      <button
        onClick={() => onSave(draftA, draftB)}
        disabled={!valid(draftA) || !valid(draftB)}
        className="w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 text-sm transition disabled:opacity-30"
      >
        Save lineup
      </button>
    </>
  )
}

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

/** Scores, sets, timeouts, and who is serving, in one compact card. */
function Scoreboard({
  portrait,
  teamA, teamB, scoreA, scoreB, setsWonA, setsWonB, timeoutsA, timeoutsB, locked,
  setHistory, servingTeam, serverPlayer, serverTeam, onPlainPoint, onTimeout,
}) {
  const block = (side, team, score, setsWon, timeouts) => {
    const right = side === 'B'
    return (
      <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
        <p className={`flex items-center gap-1 text-xs lg:text-sm font-medium text-ink min-w-0 ${right ? 'flex-row-reverse' : ''}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
          <span className="truncate">{team?.name ?? 'TBD'}</span>
          <span className="shrink-0 font-normal text-ink-faint text-[10px]">· {setsWon} set{setsWon === 1 ? '' : 's'}</span>
        </p>
        <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
          <span className="text-3xl lg:text-5xl font-display font-bold text-accent leading-none">{score}</span>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onPlainPoint(side)}
              disabled={locked}
              className="text-[10px] rounded border border-line-strong text-ink-dim hover:bg-panel-alt px-1.5 py-0.5 transition disabled:opacity-30"
            >
              + Pt
            </button>
            <button
              onClick={() => onTimeout(side)}
              disabled={locked || !timeouts}
              className="text-[10px] rounded border border-line-strong text-ink-dim hover:bg-panel-alt px-1.5 py-0.5 transition disabled:opacity-30"
            >
              TO · {timeouts}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // One card for both teams: who is serving. Sits in the middle on wide
  // screens and under the scores on an upright phone.
  const serveCard = (
    <div className="flex items-center justify-between gap-2 rounded-md border border-accent bg-accent-soft px-2 py-1 min-w-0">
      <span className="text-[10px] font-semibold text-accent uppercase shrink-0">Serving</span>
      <span className="text-xs lg:text-sm font-medium text-ink truncate">
        {serverPlayer ? serverPlayer.name : 'Server'}
        {serverPlayer?.jerseyNumber ? <span className="text-ink-faint font-normal"> · #{serverPlayer.jerseyNumber}</span> : null}
      </span>
      <span className="text-[10px] lg:text-xs text-ink-dim truncate shrink-0 max-w-[40%]">
        {serverTeam?.name ?? (servingTeam === 'A' ? 'Team A' : 'Team B')}
      </span>
    </div>
  )
  const history = setHistory.length > 0 ? setHistory.map((s) => `${s.scoreA}-${s.scoreB}`).join('  ') : 'vs'

  return (
    <div className="shrink-0 rounded-xl border border-line bg-panel px-2.5 py-1.5">
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: portrait ? '1fr auto 1fr' : 'auto 1fr auto' }}>
        {block('A', teamA, scoreA, setsWonA, timeoutsA)}
        <div className="text-center text-[10px] text-ink-faint min-w-0">
          <p className="truncate">{history}</p>
          {!portrait && <div className="mt-1">{serveCard}</div>}
        </div>
        {block('B', teamB, scoreB, setsWonB, timeoutsB)}
      </div>
      {portrait && <div className="mt-1.5">{serveCard}</div>}
    </div>
  )
}

/** The right-hand column: actions for whichever player is selected. */
function ActionColumn({
  portrait, side, teamName, playerName, locked, hasSelection, selectedIsServer, selectedIsLibero,
  liberoOnCourt, hasLibero, onAction, onOpenSub, onOpenLibero,
}) {
  const cols = portrait ? 1 : 2
  const items = VOLLEYBALL_ACTIONS.length + 2
  const rows = Math.ceil(items / cols)

  return (
    <div className="min-w-0 min-h-0 flex flex-col gap-1.5 border-l border-line bg-panel p-1.5">
      <div className="shrink-0 min-h-[2rem]">
        {hasSelection ? (
          <>
            <p className="text-[10px] text-ink-faint truncate flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
              {teamName}
            </p>
            <p className="text-xs font-medium text-ink truncate">{playerName ?? 'Player'}</p>
          </>
        ) : (
          <p className="text-[11px] text-ink-dim leading-tight">Tap a player on the court</p>
        )}
      </div>

      <div
        className="flex-1 min-h-0 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {VOLLEYBALL_ACTIONS.map((def) => {
          const needsServer = def.serverOnly && !selectedIsServer
          const liberoBlocked = selectedIsLibero && LIBERO_BLOCKED.includes(def.key)
          const disabled = !hasSelection || locked || needsServer || liberoBlocked
          const hint = def.point === 'self' ? '+1 pt' : def.point === 'opponent' ? 'opp +1' : ''
          return (
            <button
              key={def.key}
              onClick={() => onAction(def)}
              disabled={disabled}
              title={
                hasSelection && needsServer
                  ? 'Only the current server can do this'
                  : liberoBlocked
                    ? 'A libero cannot do this'
                    : undefined
              }
              className={`min-h-0 overflow-hidden rounded-md border px-1 text-[11px] lg:text-sm font-medium leading-tight transition disabled:opacity-30 ${
                def.point === 'opponent'
                  ? 'border-live text-live hover:bg-live-soft'
                  : def.point === 'self'
                    ? 'border-accent text-accent hover:bg-accent-soft'
                    : 'border-line-strong text-ink-dim hover:bg-panel-alt'
              }`}
            >
              {SHORT_LABELS[def.key] ?? def.label}
              {hint && <span className="block text-[9px] font-normal opacity-70">{hint}</span>}
            </button>
          )
        })}
        <button
          onClick={onOpenSub}
          disabled={!hasSelection || locked}
          className="min-h-0 overflow-hidden rounded-md border border-line-strong px-1 text-[11px] lg:text-sm font-medium leading-tight text-ink hover:bg-panel-alt transition disabled:opacity-30"
        >
          ⇄ Sub
        </button>
        <button
          onClick={onOpenLibero}
          disabled={!hasSelection || locked}
          className="min-h-0 overflow-hidden rounded-md border border-line-strong px-1 text-[11px] lg:text-sm font-medium leading-tight text-ink hover:bg-panel-alt transition disabled:opacity-30"
        >
          Libero
          <span className="block text-[9px] font-normal opacity-70">{liberoOnCourt ? 'on court' : hasLibero ? 'set' : 'none'}</span>
        </button>
      </div>
    </div>
  )
}

function BoxScore({ team, roster, lineup, events, liberoId }) {
  const teamEvents = events.filter((e) => e.teamId === team?.id)
  const stats = summarizeEvents(teamEvents)
  const rows = roster.filter((p) => lineup.includes(p.id) || stats.has(p.id))

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line">
        <span className="font-medium text-ink">{team?.name ?? 'TBD'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-faint border-b border-line">
              <th className="py-1.5 pl-4 pr-2">Player</th>
              <th className="py-1.5 px-1.5 text-center">K</th>
              <th className="py-1.5 px-1.5 text-center">E</th>
              <th className="py-1.5 px-1.5 text-center">TA</th>
              <th className="py-1.5 px-1.5 text-center">Hit%</th>
              <th className="py-1.5 px-1.5 text-center">Ace</th>
              <th className="py-1.5 px-1.5 text-center">SE</th>
              <th className="py-1.5 px-1.5 text-center">Blk</th>
              <th className="py-1.5 px-1.5 text-center">Dig</th>
              <th className="py-1.5 pl-1.5 pr-4 text-center">Ast</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const s = stats.get(p.id)
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="py-1.5 pl-4 pr-2 text-ink">
                    {p.jerseyNumber ? <span className="text-ink-faint">#{p.jerseyNumber} </span> : null}
                    {p.name}
                    {p.id === liberoId && <span className="ml-1 text-[9px] font-semibold text-accent">L</span>}
                  </td>
                  <td className="py-1.5 px-1.5 text-center">{s?.kills ?? 0}</td>
                  <td className="py-1.5 px-1.5 text-center">{s?.attackErrors ?? 0}</td>
                  <td className="py-1.5 px-1.5 text-center">{s?.attackAttempts ?? 0}</td>
                  <td className="py-1.5 px-1.5 text-center">{formatHitting(hittingPercentage(s))}</td>
                  <td className="py-1.5 px-1.5 text-center">{s?.aces ?? 0}</td>
                  <td className="py-1.5 px-1.5 text-center">{s?.serviceErrors ?? 0}</td>
                  <td className="py-1.5 px-1.5 text-center">{s?.blocks ?? 0}</td>
                  <td className="py-1.5 px-1.5 text-center">{s?.digs ?? 0}</td>
                  <td className="py-1.5 pl-1.5 pr-4 text-center">{s?.assists ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-1.5 text-[10px] text-ink-faint border-t border-line">
        K kills · E attack errors · TA attack attempts · Hit% = (K − E) / TA · SE service errors
      </p>
    </div>
  )
}

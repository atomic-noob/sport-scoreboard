import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, completeMatch, setMatchMvp } from '../../lib/matchesData'
import WinnerBoard from '../tournament/WinnerBoard'
import { entryKind } from '../../lib/entryMode'
import { pushCloudMatchState, clearMatchState } from '../../lib/liveMatchState'
import { saveMatchSet } from '../../lib/volleyballData'
import { newMatch, applyPoint, pointLabels, situation, setAndMatchPoint, currentServer, serveCourt, serverIdx, setNumber } from '../../lib/tennisRules'
import { TEAM_CLASS } from '../../lib/teamColors'
import usePortrait from '../../hooks/usePortrait'
import TennisCourt from './TennisCourt'

function lineupKey(matchId) {
  return `tennis-lineup:${matchId}`
}

// The in-progress match is mirrored to this device's storage so a refresh (or a
// crash) picks up exactly where the scorer left off.
function liveKey(matchId) {
  return `tennis-live:${matchId}`
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

export default function TennisMatchSimulate() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()
  const portrait = usePortrait()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [lineup, setLineup] = useState(null)
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const [m, setM] = useState(null) // match state from tennisRules, null until the first server is chosen
  const [undoStack, setUndoStack] = useState([])
  const [savedSets, setSavedSets] = useState(0) // finished sets already written to the database
  const [pendingSet, setPendingSet] = useState(false) // a set just ended and awaits confirmation
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [matchComplete, setMatchComplete] = useState(false)
  const [mvpId, setMvpId] = useState(null)
  const [savingMvp, setSavingMvp] = useState(false)
  const [lineupSig, setLineupSig] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [t, mt, teams] = await Promise.all([
          getTournament(tournamentId),
          getMatch(matchId),
          getTeamsForTournament(tournamentId),
        ])
        setTournament(t)
        setMatch(mt)
        const tA = teams.find((tm) => tm.id === mt.teamAId) ?? null
        const tB = teams.find((tm) => tm.id === mt.teamBId) ?? null
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
        const stale = live && (mt.status === 'completed' || (saved && live.sig && live.sig !== saved))
        if (stale) dropLive(matchId)

        if (live && !stale) {
          setLineupSig(live.sig ?? '')
          setLineup(live.lineup ?? null)
          setM(live.m ?? null)
          setUndoStack(live.undoStack ?? [])
          setSavedSets(live.savedSets ?? 0)
          setPendingSet(!!live.pendingSet)
        } else if (saved) {
          setLineupSig(saved)
          setLineup(JSON.parse(saved))
        }
        setHydrated(true)
      } catch (err) {
        console.error('Failed to load tennis match:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  const rules = tournament?.rules ?? {}
  const setsToWin = Number(rules.setsToWin ?? 2)
  const noAd = Number(rules.noAd) === 1
  const gamesPerSet = Number(rules.gamesPerSet ?? 6)
  const matchType = rules.matchType === 'doubles' ? 'doubles' : 'singles'
  const perSide = matchType === 'doubles' ? 2 : 1
  const engineRules = { setsToWin, gamesPerSet, noAd, matchTiebreak: Number(rules.matchTiebreak ?? 0) }

  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
  const playersA = (lineup?.idsA ?? []).map((id) => byId.get(id)).filter(Boolean)
  const playersB = (lineup?.idsB ?? []).map((id) => byId.get(id)).filter(Boolean)
  const nameOf = (side) => (side === 'A' ? teamA?.name : teamB?.name) ?? 'TBD'

  const flipped = m ? m.swaps % 2 === 1 : false
  const labels = m ? pointLabels(m, noAd) : { A: '0', B: '0' }
  const marks = m && !m.over ? setAndMatchPoint(m, engineRules) : { setPoint: {}, matchPoint: {} }
  const locked = !m || pendingSet || busy

  // ---------- Resume after refresh ----------
  useEffect(() => {
    if (!hydrated || !match || matchComplete) return
    writeLive(matchId, { sig: lineupSig, lineup, m, undoStack, savedSets, pendingSet })
  }, [hydrated, match, matchComplete, matchId, lineupSig, lineup, m, undoStack, savedSets, pendingSet])

  // ---------- Live updates for the public watch page ----------
  useEffect(() => {
    if (!match || matchComplete || !m) return undefined
    const timer = setTimeout(() => {
      pushCloudMatchState(matchId, {
        sport: 'tennis',
        matchType,
        setsToWin,
        gamesPerSet,
        noAd,
        match: m,
        flipped,
        idsA: lineup?.idsA ?? [],
        idsB: lineup?.idsB ?? [],
      })
    }, 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, matchComplete, m, lineup])

  // ---------- Scoring ----------
  function startMatch(side) {
    setM(newMatch(side))
    setNotice('')
  }

  function point(winner) {
    if (locked || m.over) return
    const { match: next, events } = applyPoint(m, winner, engineRules)
    setUndoStack((s) => [...s.slice(-60), m])
    setM(next)
    if (events.includes('set') || events.includes('match')) {
      setPendingSet(true)
      setNotice('')
    } else if (events.includes('changeEnds')) {
      setNotice('Change ends')
    } else if (events.includes('game')) {
      setNotice(`Game to ${nameOf(winner)}`)
    } else {
      setNotice('')
    }
  }

  function undo() {
    if (undoStack.length === 0 || busy) return
    const last = undoStack[undoStack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setM(last)
    setPendingSet(false)
    setNotice('')
  }

  async function confirmSet() {
    if (!pendingSet || busy) return
    setBusy(true)
    const set = m.sets[m.sets.length - 1]
    const number = m.sets.length
    const winnerTeamId = set.a > set.b ? teamA?.id : teamB?.id
    try {
      await saveMatchSet(matchId, number, set.a, set.b, winnerTeamId)
    } catch (err) {
      console.error('Could not save set result (will still continue locally):', err)
    }
    setSavedSets(number)
    setPendingSet(false)
    setUndoStack([])

    if (m.over) {
      setMatchComplete(true)
      try {
        await completeMatch(matchId, m.winsA, m.winsB)
        await clearMatchState(matchId) // spectators now read the saved result
        dropLive(matchId)
      } catch (err) {
        console.error('Failed to save final match result:', err)
        setError(`Could not save the final result: ${err.message ?? 'unknown error'}`)
      }
    }
    setBusy(false)
  }

  function handleDone() {
    dropLive(matchId)
    navigate(`/tennis/${tournamentId}/schedule`)
  }

  const setText = (s) => (s.tb && !s.tb.match ? `${s.a}-${s.b}(${Math.min(s.tb.a, s.tb.b)})` : s.tb?.match ? `[${s.a}-${s.b}]` : `${s.a}-${s.b}`)

  // ---------- Render ----------
  if (!match || !tournament) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-ink-dim">
        {error ? <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div> : 'Loading...'}
      </div>
    )
  }

  if (matchComplete && m) {
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
    // A match tiebreak (played instead of a final set) shows its own points.
    const setRows = m.sets.map((st, i) => {
      const a = st.tb?.match ? st.tb.a : st.a
      const b = st.tb?.match ? st.tb.b : st.b
      return { gameNumber: i + 1, scoreA: a, scoreB: b, winner: a > b ? 'A' : 'B' }
    })
    return (
      <WinnerBoard
        sport="tennis"
        kind={entryKind(tournament)}
        sportLabel="Tennis"
        unit="Set"
        tournamentName={tournament?.name}
        winnerName={nameOf(m.winner)}
        winnerSide={m.winner}
        nameA={nameOf('A')}
        nameB={nameOf('B')}
        gamesA={m.winsA}
        gamesB={m.winsB}
        history={setRows}
        playersA={playersA}
        playersB={playersB}
        mvpId={mvpId}
        onPickMvp={pickMvp}
        savingMvp={savingMvp}
        error={error}
        onDone={handleDone}
      />
    )
  }

  if (!lineup || playersA.length < perSide || playersB.length < perSide) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-ink-dim mb-4">Choose who is playing before scoring this match.</p>
        <Link
          to={`/tennis/${tournamentId}/match/${matchId}/lineup`}
          className="inline-block rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition"
        >
          Choose players
        </Link>
      </div>
    )
  }

  const server = m ? currentServer(m) : null
  const sIdx = m ? serverIdx(m, perSide) : 0
  const serverPlayer = server ? (server === 'A' ? playersA : playersB)[sIdx] : null
  const court = m ? serveCourt(m) : 'right'
  const inTb = m && m.mode !== 'game'
  const sit = m ? situation(m, noAd) : ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <Link to={`/tennis/${tournamentId}/schedule`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to schedule
      </Link>

      {error && (
        <div className="mt-3 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
      )}

      {/* Scoreboard */}
      <div className="rounded-xl border border-line bg-panel p-4 mt-2 mb-3">
        <p className="text-xs font-semibold text-ink-faint uppercase text-center mb-3">
          {m && !m.over ? `Set ${setNumber(m)}` : 'Match'} · {setsToWin === 1 ? 'one set' : `best of ${setsToWin * 2 - 1}`} · {matchType}
          {inTb ? (m.mode === 'matchtb' ? ' · match tiebreak' : ' · tiebreak') : ''}
        </p>
        {['A', 'B'].map((side) => (
          <div key={side} className="flex items-center justify-between mb-2 last:mb-0">
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
              <span className="min-w-0">
                <span className="block font-medium text-ink truncate">{nameOf(side)}</span>
                <span className="block text-xs text-ink-faint truncate">
                  {(side === 'A' ? playersA : playersB).map((p) => p.name).join(' / ')}
                  {m && server === side ? ' · serving' : ''}
                </span>
              </span>
            </span>
            <span className="flex items-baseline gap-3 shrink-0">
              {m && m.sets.map((s, i) => (
                <span key={i} className="text-sm text-ink-dim w-5 text-center">{side === 'A' ? s.a : s.b}</span>
              ))}
              {m && !m.over && m.mode !== 'matchtb' && (
                <span className="text-xl font-display font-bold text-ink w-7 text-center">{side === 'A' ? m.gA : m.gB}</span>
              )}
              <span className="text-4xl font-display font-bold text-accent w-14 text-right">
                {m && !m.over ? labels[side] : ''}
              </span>
            </span>
          </div>
        ))}
        <div className="border-t border-line mt-3 pt-2 text-center min-h-[2.25rem]">
          {m && serverPlayer && !m.over && !pendingSet && (
            <p className="text-xs text-ink-dim">
              {serverPlayer.name} serves from the {court === 'right' ? 'right (deuce)' : 'left (ad)'} court{sit ? ` · ${sit}` : ''}
            </p>
          )}
          {m && !pendingSet && ['A', 'B'].map(
            (side) =>
              (marks.setPoint[side] || marks.matchPoint[side]) && (
                <p key={side} className="text-xs font-semibold text-live">
                  {marks.matchPoint[side] ? 'Match point' : 'Set point'} · {nameOf(side)}
                </p>
              )
          )}
          {notice && <p className="text-xs font-semibold text-accent">{notice}</p>}
          {pendingSet && m && (
            <p className="text-sm font-semibold text-accent">
              Set {m.sets.length} to {nameOf(m.sets[m.sets.length - 1].a > m.sets[m.sets.length - 1].b ? 'A' : 'B')}, {setText(m.sets[m.sets.length - 1])}
            </p>
          )}
        </div>
      </div>

      {/* Choose first server */}
      {!m && (
        <div className="rounded-xl border border-line bg-panel p-4 mb-3 text-center">
          <p className="text-ink font-medium mb-3">Who serves first? (racket spin or coin toss)</p>
          <div className="grid grid-cols-2 gap-3">
            {['A', 'B'].map((side) => (
              <button
                key={side}
                onClick={() => startMatch(side)}
                className={`rounded-lg border-2 ${TEAM_CLASS[side].border} bg-panel-alt hover:bg-page px-3 py-4 font-medium text-ink truncate`}
              >
                {nameOf(side)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Court */}
      {m && (
        <div className="rounded-xl border border-line bg-panel p-2 mb-3">
          <div
            className="relative w-full mx-auto"
            style={portrait ? { aspectRatio: '46 / 88', maxWidth: 300 } : { aspectRatio: '88 / 46', maxWidth: 720 }}
          >
            <TennisCourt portrait={portrait} match={m} playersA={playersA} playersB={playersB} flipped={flipped} matchType={matchType} />
          </div>
          <p className="text-[11px] text-ink-faint text-center mt-1">
            {portrait
              ? `${nameOf(flipped ? 'B' : 'A')} is at the top`
              : flipped ? `${nameOf('A')} plays on the right` : `${nameOf('A')} plays on the left`}
          </p>
        </div>
      )}

      {/* Point buttons */}
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {['A', 'B'].map((side) => (
              <button
                key={side}
                onClick={() => point(side)}
                disabled={locked || m.over}
                className={`rounded-xl border-2 ${TEAM_CLASS[side].border} bg-panel hover:bg-panel-alt active:scale-[0.98] transition px-3 py-5 disabled:opacity-40`}
              >
                <span className="block text-xs text-ink-faint">Point to</span>
                <span className="block font-display font-bold text-lg text-ink truncate">{nameOf(side)}</span>
                <span className="block text-accent font-bold text-xl">+1</span>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={undo}
              disabled={undoStack.length === 0 || busy}
              className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt py-3 font-medium disabled:opacity-40"
            >
              Undo last point
            </button>
            {pendingSet && (
              <button
                onClick={confirmSet}
                disabled={busy}
                className="flex-[2] rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-3 transition disabled:opacity-50"
              >
                {busy ? 'Saving...' : m.over ? 'Confirm and finish match' : `Confirm set ${m.sets.length}`}
              </button>
            )}
          </div>
        </>
      )}

      {m && m.sets.length > 0 && !pendingSet && (
        <p className="mt-4 text-center text-xs text-ink-faint">Sets: {m.sets.map(setText).join('  ·  ')}</p>
      )}
    </div>
  )
}

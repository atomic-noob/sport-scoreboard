import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, completeMatch, setMatchMvp } from '../../lib/matchesData'
import WinnerBoard from '../tournament/WinnerBoard'
import { pushCloudMatchState, clearMatchState } from '../../lib/liveMatchState'
import { saveMatchSet } from '../../lib/volleyballData'
import { newGameState, applyServerPoint, applyFault, isGameOver, gamePointFor, reachedMidpoint, whoIsWho, scoreCall } from '../../lib/pickleballRules'
import { TEAM_CLASS } from '../../lib/teamColors'
import usePortrait from '../../hooks/usePortrait'
import PickleballCourt from './PickleballCourt'

function lineupKey(matchId) {
  return `pickleball-lineup:${matchId}`
}

// The in-progress match is mirrored to this device's storage so a refresh (or a
// crash) picks up exactly where the scorer left off.
function liveKey(matchId) {
  return `pickleball-live:${matchId}`
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

export default function PickleballMatchSimulate() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()
  const portrait = usePortrait()

  const [tournament, setTournament] = useState(null)
  const [match, setMatch] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [lineup, setLineup] = useState(null) // { idsA, idsB } or null
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const [currentGame, setCurrentGame] = useState(1)
  const [gamesWonA, setGamesWonA] = useState(0)
  const [gamesWonB, setGamesWonB] = useState(0)
  const [gs, setGs] = useState(null) // game state from pickleballRules, null until the first server is chosen
  const [history, setHistory] = useState([]) // [{ gameNumber, scoreA, scoreB, winner }]
  const [undoStack, setUndoStack] = useState([])
  const [midSwapped, setMidSwapped] = useState(false) // decider: ends changed at the interval
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [matchComplete, setMatchComplete] = useState(false)
  const [matchWinner, setMatchWinner] = useState(null)
  const [mvpId, setMvpId] = useState(null)
  const [savingMvp, setSavingMvp] = useState(false)
  const [lineupSig, setLineupSig] = useState('')

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
        // A different lineup was chosen after the saved state, or the match is over: start fresh.
        const stale = live && (m.status === 'completed' || (saved && live.sig && live.sig !== saved))
        if (stale) dropLive(matchId)

        if (live && !stale) {
          setLineupSig(live.sig ?? '')
          setLineup(live.lineup ?? null)
          setCurrentGame(live.currentGame)
          setGamesWonA(live.gamesWonA)
          setGamesWonB(live.gamesWonB)
          setGs(live.gs ?? null)
          setHistory(live.history ?? [])
          setUndoStack(live.undoStack ?? [])
          setMidSwapped(!!live.midSwapped)
        } else if (saved) {
          setLineupSig(saved)
          setLineup(JSON.parse(saved))
        }
        setHydrated(true)
      } catch (err) {
        console.error('Failed to load pickleball match:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  const gamesToWin = Number(tournament?.rules?.gamesToWin ?? 2)
  const target = Number(tournament?.rules?.pointsPerGame ?? 11)
  const matchType = tournament?.rules?.matchType === 'singles' ? 'singles' : 'doubles'
  const perSide = matchType === 'doubles' ? 2 : 1
  const isDecider = gamesToWin > 1 && currentGame === gamesToWin * 2 - 1

  const byId = new Map([...rosterA, ...rosterB].map((p) => [p.id, p]))
  const playersA = (lineup?.idsA ?? []).map((id) => byId.get(id)).filter(Boolean)
  const playersB = (lineup?.idsB ?? []).map((id) => byId.get(id)).filter(Boolean)

  const scoreA = gs?.scoreA ?? 0
  const scoreB = gs?.scoreB ?? 0
  const gameOver = gs ? isGameOver(scoreA, scoreB, target) : false
  const gamePoint = gs ? gamePointFor(gs, target) : { A: false, B: false }
  const matchPointFor = (side) => gamePoint[side] && (side === 'A' ? gamesWonA : gamesWonB) + 1 >= gamesToWin
  // Teams change ends after each game, and again at the interval of a deciding game.
  const flipped = (currentGame - 1) % 2 === 1 !== (isDecider && midSwapped)

  // ---------- Resume after refresh ----------
  useEffect(() => {
    if (!hydrated || !match || matchComplete) return
    writeLive(matchId, { sig: lineupSig, lineup, currentGame, gamesWonA, gamesWonB, gs, history, undoStack, midSwapped })
  }, [hydrated, match, matchComplete, matchId, lineupSig, lineup, currentGame, gamesWonA, gamesWonB, gs, history, undoStack, midSwapped])

  // ---------- Live updates for the public watch page ----------
  useEffect(() => {
    if (!match || matchComplete || !gs) return undefined
    const timer = setTimeout(() => {
      pushCloudMatchState(matchId, {
        sport: 'pickleball',
        matchType,
        currentGame,
        target,
        gamesToWin,
        scoreA,
        scoreB,
        gamesWonA,
        gamesWonB,
        history,
        serving: gs.serving,
        serverNum: gs.serverNum,
        court: gs.court,
        rightA: gs.rightA,
        rightB: gs.rightB,
        gameOver,
        flipped,
        idsA: lineup?.idsA ?? [],
        idsB: lineup?.idsB ?? [],
      })
    }, 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, matchComplete, gs, currentGame, gamesWonA, gamesWonB, history, midSwapped, lineup])

  // ---------- Scoring ----------
  function startGame(side) {
    setGs(newGameState(side, perSide))
    setNotice('')
  }

  // Only the serving side scores. 'point' = the server wins the rally; 'fault' = the server loses it.
  function rally(result) {
    if (!gs || gameOver || busy) return
    const next = result === 'point' ? applyServerPoint(gs, perSide) : applyFault(gs, perSide)
    setUndoStack((s) => [...s, { gs, midSwapped }])
    setGs(next)
    if (isGameOver(next.scoreA, next.scoreB, target)) {
      setNotice('')
    } else if (result === 'point' && isDecider && !midSwapped && reachedMidpoint(gs, next, target)) {
      setMidSwapped(true)
      setNotice('Change ends (deciding game)')
    } else if (result === 'fault') {
      setNotice(next.serving !== gs.serving ? 'Side out' : 'Second server')
    } else {
      setNotice('')
    }
  }

  function undo() {
    if (undoStack.length === 0 || busy) return
    const last = undoStack[undoStack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setGs(last.gs)
    setMidSwapped(last.midSwapped)
    setNotice('')
  }

  async function confirmGame() {
    if (!gameOver || busy) return
    setBusy(true)
    const winner = scoreA > scoreB ? 'A' : 'B'
    const winnerTeamId = winner === 'A' ? teamA?.id : teamB?.id
    setHistory((prev) => [...prev, { gameNumber: currentGame, scoreA, scoreB, winner }])
    try {
      await saveMatchSet(matchId, currentGame, scoreA, scoreB, winnerTeamId)
    } catch (err) {
      console.error('Could not save game result (will still continue locally):', err)
    }

    const newA = winner === 'A' ? gamesWonA + 1 : gamesWonA
    const newB = winner === 'B' ? gamesWonB + 1 : gamesWonB
    setGamesWonA(newA)
    setGamesWonB(newB)

    if (newA >= gamesToWin || newB >= gamesToWin) {
      setMatchComplete(true)
      setMatchWinner(newA > newB ? 'A' : 'B')
      try {
        await completeMatch(matchId, newA, newB)
        await clearMatchState(matchId) // spectators now read the saved result
        dropLive(matchId)
      } catch (err) {
        console.error('Failed to save final match result:', err)
        setError(`Could not save the final result: ${err.message ?? 'unknown error'}`)
      }
      setBusy(false)
      return
    }

    // Next game: the winner of the last game serves first.
    setCurrentGame((g) => g + 1)
    setGs(newGameState(winner, perSide))
    setUndoStack([])
    setMidSwapped(false)
    setNotice('')
    setBusy(false)
  }

  function handleDone() {
    dropLive(matchId)
    navigate(`/pickleball/${tournamentId}/schedule`)
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
    const winnerName = (matchWinner === 'A' ? teamA?.name : teamB?.name) ?? ''
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
    return (
      <WinnerBoard
        sportLabel="Pickleball"
        winnerName={winnerName}
        winnerSide={matchWinner}
        nameA={teamA?.name ?? 'Side A'}
        nameB={teamB?.name ?? 'Side B'}
        gamesA={gamesWonA}
        gamesB={gamesWonB}
        history={history}
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
          to={`/pickleball/${tournamentId}/match/${matchId}/lineup`}
          className="inline-block rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition"
        >
          Choose players
        </Link>
      </div>
    )
  }

  const who = gs ? whoIsWho(gs, perSide) : null
  const serverPlayer = who ? (who.server.side === 'A' ? playersA : playersB)[who.server.playerIdx] : null
  const nameOf = (side) => (side === 'A' ? teamA?.name : teamB?.name) ?? 'TBD'

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <Link to={`/pickleball/${tournamentId}/schedule`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to schedule
      </Link>

      {error && (
        <div className="mt-3 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
      )}

      {/* Scoreboard */}
      <div className="rounded-xl border border-line bg-panel p-4 mt-2 mb-3">
        <p className="text-xs font-semibold text-ink-faint uppercase text-center mb-3">
          Game {currentGame} · first to {target}, win by 2 · {matchType}
        </p>
        {['A', 'B'].map((side) => (
          <div key={side} className="flex items-center justify-between mb-2 last:mb-0">
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TEAM_CLASS[side].bg}`} />
              <span className="min-w-0">
                <span className="block font-medium text-ink truncate">{nameOf(side)}</span>
                <span className="block text-xs text-ink-faint truncate">
                  {(side === 'A' ? playersA : playersB).map((p) => p.name).join(' / ')}
                  {gs && gs.serving === side ? ' · serving' : ''}
                </span>
              </span>
            </span>
            <span className="flex items-baseline gap-3 shrink-0">
              <span className="text-xs text-ink-faint">Games {side === 'A' ? gamesWonA : gamesWonB}</span>
              <span className="text-4xl font-display font-bold text-accent w-14 text-right">{side === 'A' ? scoreA : scoreB}</span>
            </span>
          </div>
        ))}
        <div className="border-t border-line mt-3 pt-2 text-center min-h-[2.25rem]">
          {gs && serverPlayer && !gameOver && (
            <p className="text-xs text-ink-dim">
              Score call <span className="font-bold text-ink">{scoreCall(gs, perSide)}</span> · {serverPlayer.name} serves from the {who.server.court} court
            </p>
          )}
          {['A', 'B'].map(
            (side) =>
              gamePoint[side] && (
                <p key={side} className="text-xs font-semibold text-live">
                  {matchPointFor(side) ? 'Match point' : 'Game point'} · {nameOf(side)}
                </p>
              )
          )}
          {notice && <p className="text-xs font-semibold text-accent">{notice}</p>}
          {gameOver && (
            <p className="text-sm font-semibold text-accent">
              Game {currentGame} to {nameOf(scoreA > scoreB ? 'A' : 'B')}, {Math.max(scoreA, scoreB)}-{Math.min(scoreA, scoreB)}
            </p>
          )}
        </div>
      </div>

      {/* Choose first server (game 1 only; later games the previous winner serves) */}
      {!gs && (
        <div className="rounded-xl border border-line bg-panel p-4 mb-3 text-center">
          <p className="text-ink font-medium mb-3">Who serves first? (coin toss or rally winner)</p>
          <div className="grid grid-cols-2 gap-3">
            {['A', 'B'].map((side) => (
              <button
                key={side}
                onClick={() => startGame(side)}
                className={`rounded-lg border-2 ${TEAM_CLASS[side].border} bg-panel-alt hover:bg-page px-3 py-4 font-medium text-ink truncate`}
              >
                {nameOf(side)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Court */}
      {gs && (
        <div className="rounded-xl border border-line bg-panel p-2 mb-3">
          <div
            className="relative w-full mx-auto"
            style={portrait ? { aspectRatio: '28 / 52', maxWidth: 360 } : { aspectRatio: '52 / 28', maxWidth: 720 }}
          >
            <PickleballCourt portrait={portrait} state={gs} playersA={playersA} playersB={playersB} flipped={flipped} matchType={matchType} />
          </div>
          <p className="text-[11px] text-ink-faint text-center mt-1">
            {flipped ? `${nameOf('A')} plays on the right` : `${nameOf('A')} plays on the left`}
          </p>
        </div>
      )}

      {/* Point buttons */}
      {gs && (
        <>
          <p className="text-[11px] text-ink-faint text-center mb-1.5">Only the serving side scores</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => rally('point')}
              disabled={gameOver || busy}
              className={`rounded-xl border-2 ${TEAM_CLASS[gs.serving].border} bg-panel hover:bg-panel-alt active:scale-[0.98] transition px-3 py-5 disabled:opacity-40`}
            >
              <span className="block text-xs text-ink-faint">Server wins the rally</span>
              <span className="block font-display font-bold text-lg text-ink truncate">{nameOf(gs.serving)}</span>
              <span className="block text-accent font-bold text-xl">+1 point</span>
            </button>
            <button
              onClick={() => rally('fault')}
              disabled={gameOver || busy}
              className="rounded-xl border-2 border-line-strong bg-panel hover:bg-panel-alt active:scale-[0.98] transition px-3 py-5 disabled:opacity-40"
            >
              <span className="block text-xs text-ink-faint">Server loses the rally</span>
              <span className="block font-display font-bold text-lg text-ink">Fault</span>
              <span className="block text-ink-dim font-bold text-xl">{perSide === 2 && gs.serverNum === 1 ? 'Server 2 serves' : 'Side out'}</span>
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={undo}
              disabled={undoStack.length === 0 || busy}
              className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt py-3 font-medium disabled:opacity-40"
            >
              Undo last rally
            </button>
            {gameOver && (
              <button
                onClick={confirmGame}
                disabled={busy}
                className="flex-[2] rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-3 transition disabled:opacity-50"
              >
                {busy ? 'Saving...' : `Confirm game ${currentGame}`}
              </button>
            )}
          </div>
        </>
      )}

      {history.length > 0 && (
        <div className="mt-4 text-center space-y-0.5">
          {history.map((g) => (
            <p key={g.gameNumber} className="text-xs text-ink-faint">
              Game {g.gameNumber}: {g.scoreA} - {g.scoreB}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

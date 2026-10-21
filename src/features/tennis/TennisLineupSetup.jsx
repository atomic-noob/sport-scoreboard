import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, markMatchLive } from '../../lib/matchesData'
import { sortByEntryName } from '../../lib/entryMode'

function lineupKey(matchId) {
  return `tennis-lineup:${matchId}`
}

/**
 * Tennis has no rotation: pick who plays this match -- one player per side for
 * singles, two for doubles. In doubles the first player you tap serves first
 * for the team and receives in the right-hand (deuce) court.
 */
export default function TennisLineupSetup() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [idsA, setIdsA] = useState([])
  const [idsB, setIdsB] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const perSide = tournament?.rules?.matchType === 'doubles' ? 2 : 1

  useEffect(() => {
    async function load() {
      try {
        const [t, m, teams] = await Promise.all([
          getTournament(tournamentId),
          getMatch(matchId),
          getTeamsForTournament(tournamentId),
        ])
        setTournament(t)
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

        // Players / fixed pairs: the entries ARE the players, so there is nothing to choose.
        const per = t.rules?.matchType === 'doubles' ? 2 : 1
        if (t.rules?.entryType === 'players' && tA && tB && rA.length === per && rB.length === per) {
          const idsOfA = sortByEntryName(rA, tA.name).map((p) => p.id)
          const idsOfB = sortByEntryName(rB, tB.name).map((p) => p.id)
          try {
            sessionStorage.setItem(lineupKey(matchId), JSON.stringify({ idsA: idsOfA, idsB: idsOfB }))
          } catch {
            // scoring still works without it
          }
          try {
            await markMatchLive(matchId)
          } catch (err) {
            console.error('Could not mark match as live:', err)
          }
          navigate(`/tennis/${tournamentId}/match/${matchId}`, { replace: true })
          return
        }
        try {
          const saved = sessionStorage.getItem(lineupKey(matchId))
          if (saved) {
            const parsed = JSON.parse(saved)
            setIdsA(parsed.idsA ?? [])
            setIdsB(parsed.idsB ?? [])
          }
        } catch {
          // ignore a bad saved lineup
        }
      } catch (err) {
        console.error('Failed to load tennis lineup screen:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  const need = (roster) => Math.min(perSide, roster.length)

  function tapPlayer(team, playerId) {
    const ids = team === 'A' ? idsA : idsB
    const setIds = team === 'A' ? setIdsA : setIdsB
    const roster = team === 'A' ? rosterA : rosterB
    if (ids.includes(playerId)) {
      setIds(ids.filter((id) => id !== playerId))
    } else if (ids.length < need(roster)) {
      setIds([...ids, playerId])
    }
  }

  const readyA = rosterA.length > 0 && idsA.length === need(rosterA)
  const readyB = rosterB.length > 0 && idsB.length === need(rosterB)
  const canStart = readyA && readyB

  async function handleStart() {
    if (!canStart) return
    try {
      sessionStorage.setItem(lineupKey(matchId), JSON.stringify({ idsA, idsB }))
    } catch {
      // scoring still works without it
    }
    setSaving(true)
    try {
      await markMatchLive(matchId)
    } catch (err) {
      console.error('Could not mark match as live:', err)
    }
    navigate(`/tennis/${tournamentId}/match/${matchId}`)
  }

  if (!tournament || !teamA || !teamB) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-ink-dim">
        {error ? <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div> : 'Loading...'}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col" style={{ minHeight: 'calc(100vh - 20px)' }}>
      <Link to={`/tennis/${tournamentId}/schedule`} className="text-sm text-ink-faint hover:text-ink-dim shrink-0">
        ← Back to schedule
      </Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1 shrink-0">
        {perSide === 2 ? 'Choose the pairs' : 'Choose the players'}
      </h1>
      <p className="text-ink-dim text-sm mb-4 shrink-0">
        {perSide === 2
          ? 'Tap 2 players per team. The first one you tap serves first and receives in the right-hand court.'
          : 'Tap the player for each team.'}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live shrink-0">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-0">
        <PickColumn team={teamA} roster={rosterA} ids={idsA} required={need(rosterA)} onTap={(id) => tapPlayer('A', id)} />
        <PickColumn team={teamB} roster={rosterB} ids={idsB} required={need(rosterB)} onTap={(id) => tapPlayer('B', id)} />
      </div>

      <button
        onClick={handleStart}
        disabled={!canStart || saving}
        className="w-full mt-4 rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-3 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        {saving ? 'Starting...' : canStart ? 'Start match' : 'Choose the players for both teams'}
      </button>
    </div>
  )
}

function PickColumn({ team, roster, ids, required, onTap }) {
  return (
    <div className="rounded-xl border border-line bg-panel flex flex-col overflow-hidden min-h-0">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between shrink-0">
        <span className="font-medium text-ink truncate">{team?.name ?? 'TBD'}</span>
        <span className={`text-xs font-medium ${ids.length === required && required > 0 ? 'text-accent' : 'text-ink-faint'}`}>
          {ids.length} / {required}
        </span>
      </div>
      {roster.length === 0 && (
        <p className="p-3 text-sm text-ink-faint">This team has no players yet. Add them from the team page first.</p>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {roster.map((player) => {
            const picked = ids.includes(player.id)
            return (
              <button
                key={player.id}
                onClick={() => onTap(player.id)}
                className={`rounded-lg border-2 px-2 py-2.5 text-left transition ${
                  picked ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-panel-alt'
                }`}
              >
                <span className="text-xs text-ink-faint">#{player.jerseyNumber ?? '--'}</span>
                <span className="block text-sm text-ink truncate">{player.name}</span>
                {picked && required > 1 && (
                  <span className="text-[10px] font-medium text-accent">
                    {ids.indexOf(player.id) === 0 ? 'Serves first, receives right' : 'Receives left'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

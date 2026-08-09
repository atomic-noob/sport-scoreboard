import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, getRosterForTeam } from '../../lib/adminData'
import { getMatch, markMatchLive } from '../../lib/matchesData'

function lineupKey(matchId) {
  return `lineup:${matchId}`
}

export default function LineupSetup() {
  const { tournamentId, matchId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [rosterA, setRosterA] = useState([])
  const [rosterB, setRosterB] = useState([])
  const [selectedA, setSelectedA] = useState([])
  const [selectedB, setSelectedB] = useState([])
  const [error, setError] = useState('')

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

        const saved = sessionStorage.getItem(lineupKey(matchId))
        if (saved) {
          const parsed = JSON.parse(saved)
          setSelectedA(parsed.teamAStarters ?? [])
          setSelectedB(parsed.teamBStarters ?? [])
        } else {
          setSelectedA(rA.slice(0, 5).map((p) => p.id))
          setSelectedB(rB.slice(0, 5).map((p) => p.id))
        }
      } catch (err) {
        console.error('Failed to load lineup screen:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId, matchId])

  function requiredCount(roster) {
    return Math.min(5, roster.length)
  }

  function toggle(team, playerId) {
    const roster = team === 'A' ? rosterA : rosterB
    const selected = team === 'A' ? selectedA : selectedB
    const setSelected = team === 'A' ? setSelectedA : setSelectedB
    const max = requiredCount(roster)

    if (selected.includes(playerId)) {
      setSelected(selected.filter((id) => id !== playerId))
    } else {
      if (selected.length >= max) return
      setSelected([...selected, playerId])
    }
  }

  const readyA = selectedA.length === requiredCount(rosterA) && rosterA.length > 0
  const readyB = selectedB.length === requiredCount(rosterB) && rosterB.length > 0
  const canStart = readyA && readyB

  async function handleStart() {
    if (!canStart) return
    sessionStorage.setItem(
      lineupKey(matchId),
      JSON.stringify({ teamAStarters: selectedA, teamBStarters: selectedB })
    )
    try {
      await markMatchLive(matchId)
    } catch (err) {
      console.error('Could not mark match as live:', err)
      // Not fatal -- the match can still be scored, it just won't show
      // as "live" to spectators until it's retried or completed.
    }
    navigate(`/basketball/${tournamentId}/match/${matchId}`)
  }

  if (!tournament || !teamA || !teamB) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-slate-500">
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col" style={{ minHeight: 'calc(100vh - 20px)' }}>
      <Link to={`/basketball/${tournamentId}/schedule`} className="text-sm text-slate-400 hover:text-slate-600 shrink-0">
        ← Back to schedule
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-1 mb-1 shrink-0">Starting Lineups</h1>
      <p className="text-slate-500 text-sm mb-4 shrink-0">
        Tap {requiredCount(rosterA)} players per team to set the starting lineup.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shrink-0">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-0">
        <LineupColumn
          team={teamA}
          roster={rosterA}
          selected={selectedA}
          required={requiredCount(rosterA)}
          onToggle={(id) => toggle('A', id)}
        />
        <LineupColumn
          team={teamB}
          roster={rosterB}
          selected={selectedB}
          required={requiredCount(rosterB)}
          onToggle={(id) => toggle('B', id)}
        />
      </div>

      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full mt-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        {canStart ? 'Start Game' : `Select ${requiredCount(rosterA)} starters for each team`}
      </button>
    </div>
  )
}

function LineupColumn({ team, roster, selected, required, onToggle }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden min-h-0">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between shrink-0">
        <span className="font-medium text-slate-800 truncate">{team?.name ?? 'TBD'}</span>
        <span
          className={`text-xs font-medium ${selected.length === required ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          {selected.length} / {required}
        </span>
      </div>

      {roster.length === 0 && (
        <p className="text-xs text-slate-400 px-3 py-4">No players on this team's roster yet.</p>
      )}

      {/* This grid is what scrolls -- not the whole page. Court-like:
          two tiles per row, each roughly square, jersey number + name. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {roster.map((player) => {
            const isSelected = selected.includes(player.id)
            return (
              <button
                key={player.id}
                onClick={() => onToggle(player.id)}
                className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 transition ${
                  isSelected
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-2xl font-bold text-slate-800">
                  {player.jerseyNumber ?? '--'}
                </span>
                <span className="text-xs text-slate-600 text-center truncate max-w-full px-1">
                  {player.name}
                </span>
                {isSelected && (
                  <span className="text-[10px] font-medium text-orange-600">Starting</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

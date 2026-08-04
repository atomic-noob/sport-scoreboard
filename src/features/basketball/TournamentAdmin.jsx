import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, createTeam } from '../../lib/adminData'

export default function TournamentAdmin() {
  const { tournamentId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [teams, setTeams] = useState([])
  const [newTeamName, setNewTeamName] = useState('')
  const [adding, setAdding] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(null) // name that duplicates an existing team

  async function refresh() {
    const [t, teamList] = await Promise.all([
      getTournament(tournamentId),
      getTeamsForTournament(tournamentId),
    ])
    setTournament(t)
    setTeams(teamList)
  }

  useEffect(() => {
    refresh()
  }, [tournamentId])

  async function doCreateTeam(name) {
    setAdding(true)
    await createTeam(tournamentId, name)
    setNewTeamName('')
    setDuplicateWarning(null)
    setAdding(false)
    refresh()
  }

  async function handleAddTeam(e) {
    e.preventDefault()
    const name = newTeamName.trim()
    if (!name) return

    const duplicate = teams.some((t) => t.name.toLowerCase() === name.toLowerCase())
    if (duplicate) {
      setDuplicateWarning(name)
      return
    }

    await doCreateTeam(name)
  }

  function confirmDuplicateTeam() {
    doCreateTeam(newTeamName.trim())
  }

  function cancelDuplicateTeam() {
    setDuplicateWarning(null)
  }

  if (!tournament) {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-slate-500">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/basketball" className="text-sm text-slate-400 hover:text-slate-600">
        ← Back to tournaments
      </Link>
      <div className="flex items-center justify-between mt-1 mb-1">
        <h1 className="text-2xl font-bold text-slate-900">{tournament.name}</h1>
        <Link
          to={`/basketball/${tournamentId}/edit`}
          className="text-sm font-medium text-slate-400 hover:text-orange-500"
        >
          Edit tournament
        </Link>
      </div>
      <p className="text-slate-500 text-sm mb-6">
        {tournament.rules.quarterMinutes}min quarters · foul-out at {tournament.rules.foulLimit} ·{' '}
        {tournament.rules.timeoutsPerTeam} timeouts/team · max {tournament.rules.maxRosterSize}{' '}
        roster
      </p>

      <form onSubmit={handleAddTeam} className="flex gap-2 mb-2">
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => {
            setNewTeamName(e.target.value)
            setDuplicateWarning(null)
          }}
          placeholder="Team name (e.g. Thunder Hawks)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 transition disabled:opacity-50"
        >
          Add Team
        </button>
      </form>

      {duplicateWarning && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            A team named <span className="font-medium">"{duplicateWarning}"</span> already exists
            in this tournament. Add it anyway?
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={confirmDuplicateTeam}
              className="text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5 transition"
            >
              Add anyway
            </button>
            <button
              onClick={cancelDuplicateTeam}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="text-center text-slate-400 py-10 border border-dashed border-slate-200 rounded-xl">
          No teams yet. Add your first team above.
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/basketball/${tournamentId}/team/${team.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-orange-400 hover:shadow-sm transition"
            >
              <span className="font-medium text-slate-800">{team.name}</span>
              <span className="text-sm text-slate-400">Manage roster →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

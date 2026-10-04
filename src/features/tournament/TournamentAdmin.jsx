import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament, createTeam, getEvent } from '../../lib/adminData'
import { getSportConfig } from '../../lib/sportConfig'

export default function TournamentAdmin() {
  const { tournamentId, sport: sportParam } = useParams()
  const [tournament, setTournament] = useState(null)
  const [teams, setTeams] = useState([])
  const [newTeamName, setNewTeamName] = useState('')
  const [adding, setAdding] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(null) // name that duplicates an existing team
  const [error, setError] = useState('')
  const [event, setEvent] = useState(null)

  async function refresh() {
    try {
      const [t, teamList] = await Promise.all([
        getTournament(tournamentId),
        getTeamsForTournament(tournamentId),
      ])
      setTournament(t)
      setTeams(teamList)
    } catch (err) {
      console.error('Failed to load tournament:', err)
      setError('Could not load this tournament. Check your connection and try refreshing.')
    }
  }

  useEffect(() => {
    refresh()
  }, [tournamentId])

  useEffect(() => {
    if (!tournament?.eventId) { setEvent(null); return }
    getEvent(tournament.eventId).then(setEvent).catch(() => setEvent(null))
  }, [tournament?.eventId])

  async function doCreateTeam(name) {
    setAdding(true)
    setError('')
    try {
      await createTeam(tournamentId, name)
      setNewTeamName('')
      setDuplicateWarning(null)
      await refresh()
    } catch (err) {
      console.error('Failed to create team:', err)
      setError('Could not add this team. Check your connection and try again.')
    } finally {
      setAdding(false)
    }
  }

  async function handleAddTeam(e) {
    e.preventDefault()
    const name = newTeamName.trim()
    if (!name) {
      setError('Enter a team name first.')
      return
    }

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
    return (
      <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-10 text-ink-dim">
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

  const sportConfig = getSportConfig(tournament.sport ?? sportParam)
  const sport = sportConfig.key

  return (
    <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link to={`/${sport}`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to tournaments
      </Link>
      {event && (
        <Link to={`/events/${event.id}`} className="block text-xs text-accent hover:text-accent-strong mt-1">
          Part of event: {event.name} →
        </Link>
      )}
      <div className="flex items-center justify-between mt-1 mb-1">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink">{tournament.name}</h1>
        <Link
          to={`/${sport}/${tournamentId}/edit`}
          className="text-sm font-medium text-ink-faint hover:text-accent"
        >
          Edit tournament
        </Link>
      </div>
      <p className="text-ink-dim text-sm mb-4">
        {sportConfig.summarizeRules({ ...sportConfig.defaultRules, ...tournament.rules })}
      </p>

      <div className="flex gap-3 mb-6">
        <Link
          to={`/${sport}/${tournamentId}/format`}
          className="text-sm font-medium text-accent hover:text-accent"
        >
          Tournament Format →
        </Link>
        <Link
          to={`/${sport}/${tournamentId}/schedule`}
          className="text-sm font-medium text-accent hover:text-accent"
        >
          Schedule & Standings →
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
          {error}
        </div>
      )}

      <form onSubmit={handleAddTeam} className="flex gap-2 mb-2">
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => {
            setNewTeamName(e.target.value)
            setDuplicateWarning(null)
            setError('')
          }}
          placeholder="Team name (e.g. Thunder Hawks)"
          className="flex-1 rounded-lg border border-line-strong px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-4 py-2 transition disabled:opacity-50"
        >
          Add Team
        </button>
      </form>

      {duplicateWarning && (
        <div className="mb-6 rounded-lg border border-warn bg-warn-soft p-3">
          <p className="text-sm text-warn">
            A team named <span className="font-medium">"{duplicateWarning}"</span> already exists
            in this tournament. Add it anyway?
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={confirmDuplicateTeam}
              className="text-xs font-medium bg-warn hover:bg-warn text-on-warn rounded-md px-3 py-1.5 transition"
            >
              Add anyway
            </button>
            <button
              onClick={cancelDuplicateTeam}
              className="text-xs font-medium text-ink-dim hover:text-ink-dim px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="text-center text-ink-faint py-10 border border-dashed border-line rounded-xl">
          No teams yet. Add your first team above.
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/${sport}/${tournamentId}/team/${team.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent hover:shadow-sm transition"
            >
              <span className="font-medium text-ink">{team.name}</span>
              <span className="text-sm text-ink-faint">Manage roster →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

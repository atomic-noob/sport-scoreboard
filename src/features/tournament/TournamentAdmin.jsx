import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getTournament,
  getTeamsForTournament,
  createTeam,
  getEvent,
  createPlayer,
  addPlayerToRoster,
  getRosterForTeam,
  findPlayerTeamInTournament,
} from '../../lib/adminData'
import { getEntryMode, entryNameFromPlayers, sortByEntryName } from '../../lib/entryMode'
import { getMatchesForTournament } from '../../lib/matchesData'
import PlayerPicker from './PlayerPicker'
import TournamentSchedule from './TournamentSchedule'
import { Trophy, Users, ListChecks, SlidersHorizontal, UserPlus } from 'lucide-react'
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
  const [slots, setSlots] = useState([null, null]) // players mode: the player(s) of the entry being added
  const [rosters, setRosters] = useState({}) // players mode: teamId -> players, to show who is in each entry
  const [matches, setMatches] = useState(null) // null until loaded
  const [tab, setTab] = useState('teams') // 'schedule' | 'teams'
  const tabChosen = useRef(false)

  async function refresh() {
    try {
      const [t, teamList, matchList] = await Promise.all([
        getTournament(tournamentId),
        getTeamsForTournament(tournamentId),
        getMatchesForTournament(tournamentId).catch(() => []),
      ])
      setTournament(t)
      setTeams(teamList)
      setMatches(matchList)
      // First load only: an ongoing tournament opens on its schedule, a new one on its entries.
      if (!tabChosen.current) {
        tabChosen.current = true
        setTab(matchList.length > 0 ? 'schedule' : 'teams')
      }
      if (t.rules?.entryType === 'players') {
        const pairs = await Promise.all(teamList.map(async (tm) => [tm.id, sortByEntryName(await getRosterForTeam(tm.id), tm.name)]))
        setRosters(Object.fromEntries(pairs))
      }
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

  // Players mode: save one entry = the chosen player(s). The entry is named after them.
  async function handleAddEntry(e) {
    e.preventDefault()
    const need = getEntryMode(tournament).perSide
    const chosen = slots.slice(0, need)
    if (chosen.some((s) => !s)) {
      setError(need === 2 ? 'Choose both players of the pair first.' : 'Choose the player first.')
      return
    }
    if (need === 2 && chosen[0].id && chosen[0].id === chosen[1].id) {
      setError('A pair needs two different players.')
      return
    }
    setAdding(true)
    setError('')
    try {
      for (const s of chosen) {
        if (s.id) {
          const existing = await findPlayerTeamInTournament(s.id, tournamentId, null)
          if (existing) {
            setError(`${s.name} is already entered in this tournament (${existing.team.name}).`)
            return
          }
        }
      }
      const players = []
      for (const s of chosen) players.push(s.id ? { id: s.id, name: s.name } : await createPlayer({ name: s.name }))
      const team = await createTeam(tournamentId, entryNameFromPlayers(players.map((p) => p.name)))
      for (const pl of players) await addPlayerToRoster(team.id, pl.id, null)
      setSlots([null, null])
      await refresh()
    } catch (err) {
      console.error('Failed to add entry:', err)
      setError('Could not add this entry. Check your connection and try again.')
    } finally {
      setAdding(false)
    }
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
  const mode = getEntryMode(tournament)
  const Noun = mode.noun.charAt(0).toUpperCase() + mode.noun.slice(1)

  const played = (matches ?? []).filter((m) => ['completed', 'forfeit', 'bye'].includes(m.status)).length
  const total = (matches ?? []).length
  const liveNow = (matches ?? []).filter((m) => m.status === 'live').length
  const started = total > 0
  const finished = started && played === total
  const statusLabel = !started ? 'Setting up' : finished ? 'Finished' : liveNow > 0 ? 'Live now' : 'In progress'
  const statusCls = !started
    ? 'border-line text-ink-dim'
    : finished
      ? 'border-accent text-accent'
      : 'border-live text-live'
  const tabBtn = (key, label, Icon) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
        tab === key ? 'border-accent text-accent' : 'border-transparent text-ink-faint hover:text-ink-dim'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  )

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
      <div className="flex items-start justify-between gap-3 mt-1 mb-1">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink break-words">{tournament.name}</h1>
        <Link
          to={`/${sport}/${tournamentId}/edit`}
          className="text-sm font-medium text-ink-faint hover:text-accent shrink-0 mt-1"
        >
          Edit tournament
        </Link>
      </div>
      <p className="text-ink-dim text-sm mb-3">
        {sportConfig.summarizeRules({ ...sportConfig.defaultRules, entryType: "teams", ...tournament.rules })}
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusCls}`}>{statusLabel}</span>
        {started && (
          <span className="text-xs text-ink-faint">{played} of {total} games done{liveNow > 0 ? ` · ${liveNow} live` : ''}</span>
        )}
        <span className="text-xs text-ink-faint">{teams.length} {teams.length === 1 ? mode.noun : mode.nounPlural}</span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button
            onClick={() => setTab('teams')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-sm font-medium px-3.5 py-2 transition"
          >
            <UserPlus className="w-4 h-4" /> Add {mode.players ? 'players' : 'teams'}
          </button>
          <Link
            to={`/${sport}/${tournamentId}/format`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong text-ink-dim hover:text-accent hover:border-accent text-sm font-medium px-3.5 py-2 transition"
          >
            <SlidersHorizontal className="w-4 h-4" /> Format
          </Link>
          <Link
            to={`/${sport}/${tournamentId}/leaderboard`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong text-ink-dim hover:text-accent hover:border-accent text-sm font-medium px-3.5 py-2 transition"
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-line">
        {tabBtn('schedule', 'Schedule & Standings', ListChecks)}
        {tabBtn('teams', `${mode.players ? 'Players' : 'Teams'} (${teams.length})`, Users)}
      </div>

      {tab === 'schedule' && (
        <div>
          {matches && !started && (
            <div className="mb-6 rounded-xl border border-dashed border-line px-4 py-5 text-center">
              <p className="text-sm text-ink-dim mb-3">
                {teams.length === 0
                  ? `No ${mode.nounPlural} yet. Add them first, then set the format to build the schedule.`
                  : 'No games yet. Set the format to build the schedule.'}
              </p>
              <Link
                to={teams.length === 0 ? '#' : `/${sport}/${tournamentId}/format`}
                onClick={teams.length === 0 ? (e) => { e.preventDefault(); setTab('teams') } : undefined}
                className="inline-block rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-sm font-medium px-4 py-2 transition"
              >
                {teams.length === 0 ? `Add ${mode.nounPlural}` : 'Set tournament format'}
              </Link>
            </div>
          )}
          <TournamentSchedule embedded />
        </div>
      )}

      {tab === 'teams' && (
        <div>
        {error && (
          <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        )}

        {mode.players && (
          <form onSubmit={handleAddEntry} className="rounded-xl border border-line bg-panel p-4 mb-6">
            <p className="text-sm font-medium text-ink mb-3">
              {mode.perSide === 2 ? 'Add a pair. They stay together for the whole tournament.' : 'Add a player'}
            </p>
            <div className={`grid gap-3 mb-3 ${mode.perSide === 2 ? 'sm:grid-cols-2' : ''}`}>
              {Array.from({ length: mode.perSide }).map((_, i) => (
                <PlayerPicker
                  key={i}
                  label={mode.perSide === 2 ? (i === 0 ? 'Player 1 (serves first)' : 'Player 2') : 'Player'}
                  value={slots[i]}
                  onChange={(v) => { setSlots((s) => s.map((x, k) => (k === i ? v : x))); setError('') }}
                  excludeIds={slots.filter(Boolean).map((s) => s.id).filter(Boolean)}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-4 py-2 transition disabled:opacity-50"
            >
              {adding ? 'Adding...' : `Add ${Noun}`}
            </button>
          </form>
        )}

        {!mode.players && (
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
        )}

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
            No {mode.nounPlural} yet. Add your first {mode.noun} above.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-ink-faint">{teams.length} {teams.length === 1 ? mode.noun : mode.nounPlural}</p>
            {teams.map((team) => (
              <Link
                key={team.id}
                to={`/${sport}/${tournamentId}/team/${team.id}`}
                className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent hover:shadow-sm transition"
              >
                <span className="font-medium text-ink">{team.name}</span>
                <span className="text-sm text-ink-faint">{mode.players ? 'Edit players →' : 'Manage roster →'}</span>
              </Link>
            ))}
          </div>
        )}

        </div>
      )}
    </div>
  )
}

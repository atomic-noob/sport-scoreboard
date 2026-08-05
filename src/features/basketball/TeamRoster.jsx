import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getTournament,
  getRosterForTeam,
  searchPlayers,
  createPlayer,
  addPlayerToRoster,
  removeFromRoster,
  updateJerseyNumber,
  findPlayerTeamInTournament,
  transferPlayerToTeam,
} from '../../lib/adminData'

export default function TeamRoster() {
  const { tournamentId, teamId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [roster, setRoster] = useState([])
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [jerseyDraft, setJerseyDraft] = useState('')
  const [searching, setSearching] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState(null) // { player, rosterEntryId, fromTeamName }
  const [error, setError] = useState('')

  async function refreshRoster() {
    try {
      setRoster(await getRosterForTeam(teamId))
    } catch (err) {
      console.error('Failed to load roster:', err)
      setError('Could not load the roster. Check your connection and try refreshing.')
    }
  }

  useEffect(() => {
    getTournament(tournamentId).then(setTournament).catch((err) => {
      console.error('Failed to load tournament:', err)
      setError('Could not load this tournament. Check your connection.')
    })
    refreshRoster()
  }, [tournamentId, teamId])

  // Live search-as-you-type against the global players table
  useEffect(() => {
    if (query.trim().length === 0) {
      setMatches([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(async () => {
      try {
        const results = await searchPlayers(query)
        setMatches(results)
      } catch (err) {
        console.error('Search failed:', err)
        setError('Player search failed. Check your connection.')
      } finally {
        setSearching(false)
      }
    }, 200) // small debounce so we're not searching on every keystroke

    return () => clearTimeout(timeout)
  }, [query, roster])

  const rosterFull = tournament && roster.length >= tournament.rules.maxRosterSize
  const rosterIds = new Set(roster.map((p) => p.id))

  async function handleAddExisting(player) {
    if (rosterFull) return
    if (rosterIds.has(player.id)) return // already on this team, nothing to do

    setError('')
    try {
      // Check if this player is already on a different team in this tournament
      const existing = await findPlayerTeamInTournament(player.id, tournamentId, teamId)
      if (existing) {
        setPendingTransfer({
          player,
          rosterEntryId: existing.rosterEntryId,
          fromTeamName: existing.team.name,
        })
        return
      }

      await addPlayerToRoster(teamId, player.id, jerseyDraft || null)
      setQuery('')
      setJerseyDraft('')
      await refreshRoster()
    } catch (err) {
      console.error('Failed to add player:', err)
      setError('Could not add this player. Check your connection and try again.')
    }
  }

  async function confirmTransfer() {
    if (!pendingTransfer) return
    setError('')
    try {
      await transferPlayerToTeam(
        pendingTransfer.rosterEntryId,
        teamId,
        pendingTransfer.player.id,
        jerseyDraft || null
      )
      setPendingTransfer(null)
      setQuery('')
      setJerseyDraft('')
      await refreshRoster()
    } catch (err) {
      console.error('Failed to transfer player:', err)
      setError('Could not transfer this player. Check your connection and try again.')
    }
  }

  function cancelTransfer() {
    setPendingTransfer(null)
  }

  async function handleCreateNew() {
    if (rosterFull || !query.trim()) return
    setError('')
    try {
      const player = await createPlayer({ name: query.trim() })
      await addPlayerToRoster(teamId, player.id, jerseyDraft || null)
      setQuery('')
      setJerseyDraft('')
      await refreshRoster()
    } catch (err) {
      console.error('Failed to create player:', err)
      setError('Could not create this player. Check your connection and try again.')
    }
  }

  async function handleRemove(rosterEntryId) {
    setError('')
    try {
      await removeFromRoster(rosterEntryId)
      await refreshRoster()
    } catch (err) {
      console.error('Failed to remove player:', err)
      setError('Could not remove this player. Check your connection and try again.')
    }
  }

  async function handleJerseyEdit(rosterEntryId, value) {
    try {
      await updateJerseyNumber(rosterEntryId, value)
      await refreshRoster()
    } catch (err) {
      console.error('Failed to update jersey number:', err)
      setError('Could not save the jersey number. Check your connection.')
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link to={`/basketball/${tournamentId}`} className="text-sm text-slate-400 hover:text-slate-600">
        ← Back to teams
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-1 mb-1">Roster</h1>
      {tournament && (
        <p className="text-slate-500 text-sm mb-6">
          {roster.length} / {tournament.rules.maxRosterSize} players
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add player */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Add a player</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player name..."
            disabled={rosterFull}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
          />
          <input
            type="text"
            value={jerseyDraft}
            onChange={(e) => setJerseyDraft(e.target.value)}
            placeholder="#"
            disabled={rosterFull}
            className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
          />
        </div>

        {rosterFull && (
          <p className="text-xs text-amber-600">Roster is full for this tournament.</p>
        )}

        {pendingTransfer && (
          <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              <span className="font-medium">{pendingTransfer.player.name}</span> is already on{' '}
              <span className="font-medium">{pendingTransfer.fromTeamName}</span> in this
              tournament. Adding them here will move them off that team.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={confirmTransfer}
                className="text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5 transition"
              >
                Transfer to this team
              </button>
              <button
                onClick={cancelTransfer}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {query.trim().length > 0 && !rosterFull && !pendingTransfer && (
          <div className="border-t border-slate-100 pt-2 mt-1 space-y-1">
            {searching && <p className="text-xs text-slate-400 px-1">Searching...</p>}

            {!searching && matches.length === 0 && (
              <button
                onClick={handleCreateNew}
                className="w-full text-left px-2 py-2 rounded-lg hover:bg-orange-50 text-sm text-slate-700"
              >
                <span className="font-medium text-orange-600">+ Create new player</span>{' '}
                "{query.trim()}"
              </button>
            )}

            {matches.map((player) => {
              const alreadyOnThisTeam = rosterIds.has(player.id)
              return (
                <button
                  key={player.id}
                  onClick={() => handleAddExisting(player)}
                  disabled={alreadyOnThisTeam}
                  className={`w-full flex items-center justify-between text-left px-2 py-2 rounded-lg text-sm ${
                    alreadyOnThisTeam
                      ? 'text-slate-400 cursor-not-allowed bg-slate-50'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>{player.name}</span>
                  <span className="text-xs text-slate-400">
                    {alreadyOnThisTeam ? 'Already on this team' : 'Existing player · tap to add'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Roster list */}
      {roster.length === 0 ? (
        <div className="text-center text-slate-400 py-10 border border-dashed border-slate-200 rounded-xl">
          No players yet. Search above to add your first player.
        </div>
      ) : (
        <div className="space-y-2">
          {roster.map((player) => (
            <div
              key={player.rosterEntryId}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={player.jerseyNumber ?? ''}
                  onChange={(e) => handleJerseyEdit(player.rosterEntryId, e.target.value)}
                  placeholder="#"
                  className="w-10 rounded-md border border-slate-300 px-1 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="font-medium text-slate-800">{player.name}</span>
              </div>
              <button
                onClick={() => handleRemove(player.rosterEntryId)}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

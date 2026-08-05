import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament } from '../../lib/adminData'
import { setFormatConfig, generateRoundRobinSchedule } from '../../lib/matchesData'

const DEFAULT_CONFIG = {
  roundRobinGamesPerMatchup: 1,
  eliminationTeamsAdvancing: 4,
  seedingMethod: 'random', // 'random' | 'manual'
  seedOrder: [], // array of team ids, best-to-worst seed
}

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function TournamentFormat() {
  const { tournamentId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [teams, setTeams] = useState([])
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [seedOrder, setSeedOrder] = useState([]) // array of team objects, best-to-worst
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [t, teamList] = await Promise.all([
          getTournament(tournamentId),
          getTeamsForTournament(tournamentId),
        ])
        setTournament(t)
        setTeams(teamList)

        const existingConfig = t.formatConfig ?? DEFAULT_CONFIG
        setConfig({ ...DEFAULT_CONFIG, ...existingConfig })

        // Build the seed order list of team objects, in whatever order
        // was saved, falling back to teams' natural order for any not
        // yet in the saved seed order (e.g. teams added after seeding).
        const savedOrder = existingConfig.seedOrder ?? []
        const byId = new Map(teamList.map((tm) => [tm.id, tm]))
        const ordered = savedOrder.map((id) => byId.get(id)).filter(Boolean)
        const missing = teamList.filter((tm) => !savedOrder.includes(tm.id))
        setSeedOrder([...ordered, ...missing])
      } catch (err) {
        console.error('Failed to load format setup:', err)
        setError('Could not load this tournament. Check your connection and try refreshing.')
      }
    }
    load()
  }, [tournamentId])

  function moveSeed(index, direction) {
    setSeedOrder((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleSaveAndGenerate() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const finalOrder =
        config.seedingMethod === 'random' ? shuffle(seedOrder) : seedOrder

      const newConfig = { ...config, seedOrder: finalOrder.map((t) => t.id) }
      await setFormatConfig(tournamentId, newConfig)
      setConfig(newConfig)
      setSeedOrder(finalOrder)

      await generateRoundRobinSchedule(
        tournamentId,
        finalOrder.map((t) => t.id),
        config.roundRobinGamesPerMatchup
      )

      setSuccess(
        `Round-robin schedule generated: ${teams.length} teams, ${config.roundRobinGamesPerMatchup} game(s) per matchup.`
      )
    } catch (err) {
      console.error('Failed to save format / generate schedule:', err)
      setError('Could not save the format or generate the schedule. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  if (!tournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-slate-500">
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

  const notEnoughTeams = teams.length < 2

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link to={`/basketball/${tournamentId}`} className="text-sm text-slate-400 hover:text-slate-600">
        ← Back to teams
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-1 mb-1">Tournament Format</h1>
      <p className="text-slate-500 text-sm mb-6">
        Set up the round-robin phase and how teams advance to elimination.
      </p>

      {notEnoughTeams && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Add at least 2 teams before setting up the format.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Games per round-robin matchup
            </label>
            <input
              type="number"
              min="1"
              value={config.roundRobinGamesPerMatchup}
              onChange={(e) =>
                setConfig((c) => ({ ...c, roundRobinGamesPerMatchup: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Teams advancing to elimination
            </label>
            <input
              type="number"
              min="2"
              max={teams.length || undefined}
              value={config.eliminationTeamsAdvancing}
              onChange={(e) =>
                setConfig((c) => ({ ...c, eliminationTeamsAdvancing: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Seeding method</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, seedingMethod: 'random' }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                config.seedingMethod === 'random'
                  ? 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Random draw
            </button>
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, seedingMethod: 'manual' }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                config.seedingMethod === 'manual'
                  ? 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Manual seeding
            </button>
          </div>
        </div>

        {config.seedingMethod === 'manual' && seedOrder.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Seed order (best to worst)
            </label>
            <div className="space-y-1">
              {seedOrder.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-sm text-slate-700">
                    <span className="text-slate-400 font-mono mr-2">#{index + 1}</span>
                    {team.name}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveSeed(index, -1)}
                      disabled={index === 0}
                      className="text-slate-400 hover:text-orange-500 disabled:opacity-20 disabled:hover:text-slate-400 px-1.5"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveSeed(index, 1)}
                      disabled={index === seedOrder.length - 1}
                      className="text-slate-400 hover:text-orange-500 disabled:opacity-20 disabled:hover:text-slate-400 px-1.5"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {config.seedingMethod === 'random' && (
          <p className="text-xs text-slate-400">
            Seeds will be shuffled randomly when you generate the schedule below.
          </p>
        )}

        <button
          onClick={handleSaveAndGenerate}
          disabled={saving || notEnoughTeams}
          className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 transition disabled:opacity-50"
        >
          {saving ? 'Generating...' : 'Save Format & Generate Round-Robin Schedule'}
        </button>

        <Link
          to={`/basketball/${tournamentId}/schedule`}
          className="block text-center text-sm text-slate-500 hover:text-orange-600"
        >
          View schedule & standings →
        </Link>
      </div>
    </div>
  )
}

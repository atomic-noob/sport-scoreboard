import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament } from '../../lib/adminData'
import {
  setFormatConfig,
  generateRoundRobinSchedule,
  generateLimitedRoundRobinSchedule,
  getMatchesForTournament,
} from '../../lib/matchesData'

const DEFAULT_CONFIG = {
  scheduleType: 'full', // 'full' | 'limited'
  roundRobinGamesPerMatchup: 1,
  gamesPerTeam: 4,
  eliminationTeamsAdvancing: 4,
  seedingMethod: 'random', // 'random' | 'manual'
  seedOrder: [], // array of team ids, best-to-worst
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
  const [hasCompletedGames, setHasCompletedGames] = useState(false)
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [t, teamList, matches] = await Promise.all([
          getTournament(tournamentId),
          getTeamsForTournament(tournamentId),
          getMatchesForTournament(tournamentId),
        ])
        setTournament(t)
        setTeams(teamList)
        setHasCompletedGames(
          matches.some((m) => m.phase === 'round_robin' && m.status === 'completed')
        )

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

  async function runSaveAndGenerate() {
    setSaving(true)
    setError('')
    setSuccess('')
    setConfirmingRegenerate(false)
    try {
      const finalOrder =
        config.seedingMethod === 'random' ? shuffle(seedOrder) : seedOrder

      const newConfig = { ...config, seedOrder: finalOrder.map((t) => t.id) }
      await setFormatConfig(tournamentId, newConfig)
      setConfig(newConfig)
      setSeedOrder(finalOrder)

      const teamIds = finalOrder.map((t) => t.id)

      if (config.scheduleType === 'limited') {
        await generateLimitedRoundRobinSchedule(tournamentId, teamIds, config.gamesPerTeam)
        setSuccess(
          `Schedule generated: ${teams.length} teams, ${config.gamesPerTeam} game(s) per team.`
        )
      } else {
        await generateRoundRobinSchedule(tournamentId, teamIds, config.roundRobinGamesPerMatchup)
        setSuccess(
          `Round-robin schedule generated: ${teams.length} teams, ${config.roundRobinGamesPerMatchup} game(s) per matchup.`
        )
      }
      setHasCompletedGames(false)
    } catch (err) {
      console.error('Failed to save format / generate schedule:', err)
      setError(`Could not save the format or generate the schedule: ${err.message ?? 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  function handleSaveAndGenerate() {
    // Regenerating the round-robin schedule DELETES all existing
    // round-robin matches first -- if any games are already completed,
    // that result data would be lost. Confirm before doing that.
    if (hasCompletedGames) {
      setConfirmingRegenerate(true)
      return
    }
    runSaveAndGenerate()
  }

  if (!tournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-ink-dim">
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

  const notEnoughTeams = teams.length < 2

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link to={`/basketball/${tournamentId}`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to teams
      </Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1">Tournament Format</h1>
      <p className="text-ink-dim text-sm mb-6">
        Set up the round-robin phase and how teams advance to elimination.
      </p>

      {notEnoughTeams && (
        <div className="mb-6 rounded-lg border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
          Add at least 2 teams before setting up the format.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm text-accent">
          {success}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink-dim mb-2">Schedule type</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, scheduleType: 'full' }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                config.scheduleType === 'full'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line-strong text-ink-dim hover:bg-panel-alt'
              }`}
            >
              Full round-robin
            </button>
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, scheduleType: 'limited' }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                config.scheduleType === 'limited'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line-strong text-ink-dim hover:bg-panel-alt'
              }`}
            >
              Fixed games per team
            </button>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            {config.scheduleType === 'full'
              ? 'Every team plays every other team.'
              : 'Each team plays a set number of games, not the full field \u2014 common for leagues with limited time.'}
          </p>
        </div>

        {config.scheduleType === 'full' ? (
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1">
              Games per round-robin matchup
            </label>
            <input
              type="number"
              min="1"
              value={config.roundRobinGamesPerMatchup}
              onChange={(e) =>
                setConfig((c) => ({ ...c, roundRobinGamesPerMatchup: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1">
              Games per team
            </label>
            <input
              type="number"
              min="1"
              max={teams.length > 0 ? teams.length - 1 : undefined}
              value={config.gamesPerTeam}
              onChange={(e) => setConfig((c) => ({ ...c, gamesPerTeam: Number(e.target.value) }))}
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-ink-faint mt-1">
              Max {teams.length > 0 ? teams.length - 1 : '-'} (can't play more games than there
              are other teams). With an odd number of teams, some teams may end up with one game
              more or less than others -- that's a natural side effect of fair bye rotation, not
              an error.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-ink-dim mb-1">
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
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-dim mb-2">Seeding method</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, seedingMethod: 'random' }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                config.seedingMethod === 'random'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line-strong text-ink-dim hover:bg-panel-alt'
              }`}
            >
              Random draw
            </button>
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, seedingMethod: 'manual' }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                config.seedingMethod === 'manual'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line-strong text-ink-dim hover:bg-panel-alt'
              }`}
            >
              Manual seeding
            </button>
          </div>
        </div>

        {config.seedingMethod === 'manual' && seedOrder.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-2">
              Seed order (best to worst)
            </label>
            <div className="space-y-1">
              {seedOrder.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2"
                >
                  <span className="text-sm text-ink-dim">
                    <span className="text-ink-faint font-mono mr-2">#{index + 1}</span>
                    {team.name}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveSeed(index, -1)}
                      disabled={index === 0}
                      className="text-ink-faint hover:text-accent disabled:opacity-20 disabled:hover:text-ink-faint px-1.5"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveSeed(index, 1)}
                      disabled={index === seedOrder.length - 1}
                      className="text-ink-faint hover:text-accent disabled:opacity-20 disabled:hover:text-ink-faint px-1.5"
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
          <p className="text-xs text-ink-faint">
            Seeds will be shuffled randomly when you generate the schedule below.
          </p>
        )}

        <button
          onClick={handleSaveAndGenerate}
          disabled={saving || notEnoughTeams}
          className="w-full rounded-lg bg-accent-soft0 hover:bg-accent-strong text-white font-medium py-2.5 transition disabled:opacity-50"
        >
          {saving
            ? 'Generating...'
            : hasCompletedGames
              ? 'Regenerate Round-Robin Schedule'
              : 'Save Format & Generate Round-Robin Schedule'}
        </button>

        {confirmingRegenerate && (
          <div className="rounded-lg border border-warn bg-warn-soft p-3">
            <p className="text-sm text-warn">
              Some round-robin games are already completed. Regenerating will{' '}
              <span className="font-medium">erase those results</span> and create a fresh
              schedule. Continue?
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={runSaveAndGenerate}
                className="text-xs font-medium bg-warn-soft0 hover:bg-warn text-white rounded-md px-3 py-1.5 transition"
              >
                Yes, erase and regenerate
              </button>
              <button
                onClick={() => setConfirmingRegenerate(false)}
                className="text-xs font-medium text-ink-dim hover:text-ink-dim px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <Link
          to={`/basketball/${tournamentId}/schedule`}
          className="block text-center text-sm text-ink-dim hover:text-accent"
        >
          View schedule & standings →
        </Link>
      </div>
    </div>
  )
}

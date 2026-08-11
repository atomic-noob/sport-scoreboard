import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament } from '../../lib/adminData'
import {
  getMatchesForTournament,
  computeStandings,
  generateEliminationBracket,
  forfeitMatch,
} from '../../lib/matchesData'

export default function TournamentSchedule() {
  const { tournamentId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState('standings') // 'standings' | 'schedule' | 'bracket'

  async function refresh() {
    try {
      const [t, teamList, matchList] = await Promise.all([
        getTournament(tournamentId),
        getTeamsForTournament(tournamentId),
        getMatchesForTournament(tournamentId),
      ])
      setTournament(t)
      setTeams(teamList)
      setMatches(matchList)
    } catch (err) {
      console.error('Failed to load schedule:', err)
      setError('Could not load schedule data. Check your connection and try refreshing.')
    }
  }

  useEffect(() => {
    refresh()
  }, [tournamentId])

  const teamById = new Map(teams.map((t) => [t.id, t]))
  const teamName = (id) => teamById.get(id)?.name ?? (id ? 'Unknown team' : 'TBD')

  const roundRobinMatches = matches.filter((m) => m.phase === 'round_robin')
  const playInMatches = matches.filter((m) => m.phase === 'play_in')
  const eliminationMatches = matches.filter((m) => m.phase === 'elimination')
  const standings = computeStandings(teams, matches)

  // A match is "resolved" once it has a result of some kind -- played,
  // forfeited, or a bye. Only "scheduled"/"live" means still pending.
  const isResolved = (m) => ['completed', 'forfeit', 'bye'].includes(m.status)
  const roundRobinComplete =
    roundRobinMatches.length > 0 && roundRobinMatches.every(isResolved)

  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false)

  async function runGenerateBracket() {
    if (!tournament?.formatConfig) return
    setGenerating(true)
    setError('')
    setConfirmingRegenerate(false)
    try {
      const { eliminationTeamsAdvancing, seedOrder } = tournament.formatConfig

      const hasCompletedGames = roundRobinMatches.some((m) => m.status === 'completed')
      const orderedIds = hasCompletedGames
        ? standings.map((s) => s.team.id)
        : (seedOrder ?? teams.map((t) => t.id))

      await generateEliminationBracket(tournamentId, orderedIds, eliminationTeamsAdvancing)
      await refresh()
      setTab('bracket')
    } catch (err) {
      console.error('Failed to generate bracket:', err)
      setError(`Could not generate the bracket: ${err.message ?? 'unknown error'}. Check your connection and try again.`)
    } finally {
      setGenerating(false)
    }
  }

  function handleGenerateBracket() {
    if (!roundRobinComplete) return // locked -- see the message rendered near the button
    if (eliminationMatches.length > 0 || playInMatches.length > 0) {
      setConfirmingRegenerate(true)
      return
    }
    runGenerateBracket()
  }

  async function handleForfeit(matchId, forfeitingTeamId) {
    setError('')
    try {
      await forfeitMatch(matchId, forfeitingTeamId)
      await refresh()
    } catch (err) {
      console.error('Failed to record forfeit:', err)
      setError(`Could not record the forfeit: ${err.message ?? 'unknown error'}`)
    }
  }

  if (!tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-ink-dim">
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/basketball/${tournamentId}`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to teams
      </Link>
      <div className="flex items-center justify-between mt-1 mb-4">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink">{tournament.name}</h1>
        <Link
          to={`/basketball/${tournamentId}/leaderboard`}
          className="text-sm font-medium text-ink-faint hover:text-accent"
        >
          🏆 Leaderboard
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-line">
        {['standings', 'schedule', 'bracket'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1 ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-faint hover:text-ink-dim'
            }`}
          >
            {t === 'standings' ? 'Standings' : t === 'schedule' ? 'Round-Robin' : 'Bracket'}
            {t === 'bracket' && !roundRobinComplete && (
              <span className="text-[10px]" title="Locked until the round-robin is complete">🔒</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'standings' && (
        <div>
          {standings.length === 0 ? (
            <EmptyState text="No teams yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-faint border-b border-line">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Team</th>
                    <th className="py-2 pr-2 text-center">W</th>
                    <th className="py-2 pr-2 text-center">L</th>
                    <th className="py-2 pr-2 text-center">PF</th>
                    <th className="py-2 pr-2 text-center">PA</th>
                    <th className="py-2 pr-2 text-center">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.team.id} className="border-b border-line">
                      <td className="py-2 pr-2 text-ink-faint">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium text-ink">{s.team.name}</td>
                      <td className="py-2 pr-2 text-center">{s.wins}</td>
                      <td className="py-2 pr-2 text-center">{s.losses}</td>
                      <td className="py-2 pr-2 text-center">{s.pointsFor}</td>
                      <td className="py-2 pr-2 text-center">{s.pointsAgainst}</td>
                      <td className="py-2 pr-2 text-center">
                        {(s.winPct * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {roundRobinMatches.length > 0 && !roundRobinComplete && (
            <div className="mt-6 rounded-lg border border-line bg-page px-3 py-2.5 text-center">
              <p className="text-sm text-ink-dim">
                🔒 Bracket locked until the round-robin finishes.{' '}
                <span className="font-medium text-ink-dim">
                  {roundRobinMatches.filter((m) => !isResolved(m)).length} game(s) remaining
                </span>
              </p>
            </div>
          )}

          {(roundRobinMatches.length === 0 || roundRobinComplete) && (
            <button
              onClick={handleGenerateBracket}
              disabled={generating || roundRobinMatches.length === 0 || !roundRobinComplete}
              className="w-full mt-6 rounded-lg bg-accent-soft0 hover:bg-accent-strong text-white font-medium py-2.5 transition disabled:opacity-50"
            >
              {generating
                ? 'Generating...'
                : eliminationMatches.length > 0 || playInMatches.length > 0
                  ? 'Regenerate Elimination Bracket'
                  : 'Generate Elimination Bracket'}
            </button>
          )}
          {roundRobinMatches.length === 0 && (
            <p className="text-xs text-ink-faint text-center mt-2">
              Set up the format and generate a round-robin schedule first.
            </p>
          )}

          {confirmingRegenerate && (
            <div className="mt-3 rounded-lg border border-warn bg-warn-soft p-3">
              <p className="text-sm text-warn">
                A bracket already exists. Regenerating will <span className="font-medium">erase
                all existing play-in and elimination results</span> and start fresh. Continue?
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={runGenerateBracket}
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
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-2">
          {roundRobinMatches.length === 0 ? (
            <EmptyState text="No round-robin schedule yet. Set it up in Tournament Format." />
          ) : (
            roundRobinMatches.map((m) => (
              <MatchRow key={m.id} match={m} teamName={teamName} tournamentId={tournamentId} onForfeit={handleForfeit} />
            ))
          )}
        </div>
      )}

      {tab === 'bracket' && (
        <div className="space-y-4">
          {!roundRobinComplete ? (
            <div className="text-center text-ink-faint py-10 border border-dashed border-line rounded-xl">
              🔒 The bracket unlocks once every round-robin game is finished.
              <div className="text-xs mt-1">
                {roundRobinMatches.filter((m) => !isResolved(m)).length} game(s) remaining
              </div>
            </div>
          ) : (
            <>
              {playInMatches.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-faint uppercase mb-2">Play-in</h3>
                  <div className="space-y-2">
                    {playInMatches.map((m) => (
                      <MatchRow key={m.id} match={m} teamName={teamName} tournamentId={tournamentId} onForfeit={handleForfeit} />
                    ))}
                  </div>
                </div>
              )}

              {eliminationMatches.length === 0 ? (
                <EmptyState text="No bracket generated yet." />
              ) : (
                Object.entries(
                  eliminationMatches.reduce((acc, m) => {
                    acc[m.round] = acc[m.round] ?? []
                    acc[m.round].push(m)
                    return acc
                  }, {})
                )
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([round, roundMatches]) => (
                    <div key={round}>
                      <h3 className="text-xs font-semibold text-ink-faint uppercase mb-2">
                        Round {round}
                      </h3>
                      <div className="space-y-2">
                        {roundMatches.map((m) => (
                          <MatchRow key={m.id} match={m} teamName={teamName} tournamentId={tournamentId} onForfeit={handleForfeit} />
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match, teamName, tournamentId, onForfeit }) {
  const [confirmingForfeit, setConfirmingForfeit] = useState(false)
  const isBye = match.status === 'bye'
  const canForfeit =
    (match.status === 'scheduled' || match.status === 'live') && match.teamAId && match.teamBId
  const isPlayable = canForfeit
  const isViewable = match.status === 'completed'

  const content = (
    <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={match.winnerTeamId === match.teamAId ? 'font-semibold text-ink' : 'text-ink-dim'}>
          {teamName(match.teamAId)}
        </span>
        <span className="text-ink-faint">vs</span>
        <span className={match.winnerTeamId === match.teamBId ? 'font-semibold text-ink' : 'text-ink-dim'}>
          {isBye ? 'BYE' : teamName(match.teamBId)}
        </span>
      </div>
      <div className="text-xs flex items-center gap-2">
        {match.status === 'completed' && (
          <span className="text-ink-dim">
            {match.teamAScore} - {match.teamBScore}
          </span>
        )}
        {match.status === 'scheduled' && <span className="text-ink-faint">Scheduled</span>}
        {match.status === 'live' && <span className="text-live font-medium">● LIVE</span>}
        {match.status === 'bye' && <span className="text-ink-faint">Bye</span>}
        {match.status === 'forfeit' && (
          <span className="text-live">Forfeit ({teamName(match.forfeitTeamId)})</span>
        )}
        {isPlayable && <span className="text-accent font-medium">Play →</span>}
        {isViewable && <span className="text-ink-faint font-medium">Box score →</span>}
      </div>
    </div>
  )

  return (
    <div>
      {isPlayable ? (
        <Link to={`/basketball/${tournamentId}/match/${match.id}/lineup`} className="block hover:border-accent rounded-lg transition">
          {content}
        </Link>
      ) : isViewable ? (
        <Link to={`/watch/${tournamentId}/match/${match.id}`} className="block hover:border-accent rounded-lg transition">
          {content}
        </Link>
      ) : (
        content
      )}

      {canForfeit && !confirmingForfeit && (
        <button
          onClick={() => setConfirmingForfeit(true)}
          className="text-[11px] text-ink-faint hover:text-live mt-1 ml-1"
        >
          Mark a team as forfeiting
        </button>
      )}

      {confirmingForfeit && (
        <div className="mt-1 rounded-lg border border-live bg-live-soft p-2.5">
          <p className="text-xs text-live mb-2">Which team is forfeiting?</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onForfeit(match.id, match.teamAId); setConfirmingForfeit(false) }}
              className="flex-1 text-xs rounded-md bg-panel border border-live text-live px-2 py-1.5 hover:bg-live-soft transition"
            >
              {teamName(match.teamAId)}
            </button>
            <button
              onClick={() => { onForfeit(match.id, match.teamBId); setConfirmingForfeit(false) }}
              className="flex-1 text-xs rounded-md bg-panel border border-live text-live px-2 py-1.5 hover:bg-live-soft transition"
            >
              {teamName(match.teamBId)}
            </button>
            <button
              onClick={() => setConfirmingForfeit(false)}
              className="text-xs text-ink-dim hover:text-ink-dim px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="text-center text-ink-faint py-10 border border-dashed border-line rounded-xl">
      {text}
    </div>
  )
}

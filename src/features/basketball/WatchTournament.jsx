import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament } from '../../lib/adminData'
import { getMatchesForTournament, computeStandings } from '../../lib/matchesData'

export default function WatchTournament() {
  const { tournamentId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState('standings')

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
      console.error('Failed to load tournament:', err)
      setError('Could not load this tournament. Check your connection and try refreshing.')
    }
  }

  useEffect(() => {
    refresh()
    // Spectators don't have a live socket connection open here -- poll
    // gently so the schedule/standings stay reasonably current even
    // without opening a specific live match.
    const interval = setInterval(refresh, 20000)
    return () => clearInterval(interval)
  }, [tournamentId])

  const teamById = new Map(teams.map((t) => [t.id, t]))
  const teamName = (id) => teamById.get(id)?.name ?? (id ? 'Unknown team' : 'TBD')

  const roundRobinMatches = matches.filter((m) => m.phase === 'round_robin')
  const playInMatches = matches.filter((m) => m.phase === 'play_in')
  const eliminationMatches = matches.filter((m) => m.phase === 'elimination')
  const standings = computeStandings(teams, matches)
  const isResolved = (m) => ['completed', 'forfeit', 'bye'].includes(m.status)
  const roundRobinComplete = roundRobinMatches.length > 0 && roundRobinMatches.every(isResolved)
  const liveCount = matches.filter((m) => m.status === 'live').length

  if (!tournament) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        ) : (
          <p className="text-ink-faint">Loading...</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-panel">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/watch" className="text-sm text-ink-faint hover:text-ink-dim">
            ← All tournaments
          </Link>
          {liveCount > 0 && (
            <span className="text-xs font-medium text-live flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
              {liveCount} live now
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink mb-4">{tournament.name}</h1>

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
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t
                  ? 'border-accent text-accent'
                  : 'border-transparent text-ink-faint hover:text-ink-dim'
              }`}
            >
              {t === 'standings' ? 'Standings' : t === 'schedule' ? 'Round-Robin' : 'Bracket'}
            </button>
          ))}
        </div>

        {tab === 'standings' && (
          <div className="overflow-x-auto">
            {standings.length === 0 ? (
              <EmptyState text="No teams yet." />
            ) : (
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
                      <td className="py-2 pr-2 text-center">{(s.winPct * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'schedule' && (
          <div className="space-y-2">
            {roundRobinMatches.length === 0 ? (
              <EmptyState text="No round-robin schedule yet." />
            ) : (
              roundRobinMatches.map((m) => (
                <WatchMatchRow key={m.id} match={m} teamName={teamName} tournamentId={tournamentId} />
              ))
            )}
          </div>
        )}

        {tab === 'bracket' && (
          <div className="space-y-4">
            {!roundRobinComplete ? (
              <EmptyState text="Bracket not started yet -- round-robin still in progress." />
            ) : (
              <>
                {playInMatches.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-ink-faint uppercase mb-2">Play-in</h3>
                    <div className="space-y-2">
                      {playInMatches.map((m) => (
                        <WatchMatchRow key={m.id} match={m} teamName={teamName} tournamentId={tournamentId} />
                      ))}
                    </div>
                  </div>
                )}
                {eliminationMatches.length === 0 ? (
                  <EmptyState text="No bracket yet." />
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
                        <h3 className="text-xs font-semibold text-ink-faint uppercase mb-2">Round {round}</h3>
                        <div className="space-y-2">
                          {roundMatches.map((m) => (
                            <WatchMatchRow key={m.id} match={m} teamName={teamName} tournamentId={tournamentId} />
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
    </div>
  )
}

function WatchMatchRow({ match, teamName, tournamentId }) {
  const isBye = match.status === 'bye'
  const isWatchable = match.status === 'live' || match.status === 'completed'

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
          <span className="text-ink-dim">{match.teamAScore} - {match.teamBScore}</span>
        )}
        {match.status === 'scheduled' && <span className="text-ink-faint">Scheduled</span>}
        {match.status === 'live' && <span className="text-live font-medium">● LIVE</span>}
        {match.status === 'bye' && <span className="text-ink-faint">Bye</span>}
        {match.status === 'forfeit' && <span className="text-live">Forfeit ({teamName(match.forfeitTeamId)})</span>}
        {isWatchable && <span className="text-accent font-medium">View →</span>}
      </div>
    </div>
  )

  return isWatchable ? (
    <Link to={`/watch/${tournamentId}/match/${match.id}`} className="block hover:border-accent rounded-lg transition">
      {content}
    </Link>
  ) : (
    content
  )
}

function EmptyState({ text }) {
  return (
    <div className="text-center text-ink-faint py-10 border border-dashed border-line rounded-xl">
      {text}
    </div>
  )
}

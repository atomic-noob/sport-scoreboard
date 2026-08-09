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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <p className="text-slate-400">Loading...</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/watch" className="text-sm text-slate-400 hover:text-slate-600">
            ← All tournaments
          </Link>
          {liveCount > 0 && (
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {liveCount} live now
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">{tournament.name}</h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {['standings', 'schedule', 'bracket'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
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
                  <tr className="text-left text-slate-400 border-b border-slate-200">
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
                    <tr key={s.team.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium text-slate-800">{s.team.name}</td>
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
                    <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Play-in</h3>
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
                        <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Round {round}</h3>
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
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={match.winnerTeamId === match.teamAId ? 'font-semibold text-slate-900' : 'text-slate-700'}>
          {teamName(match.teamAId)}
        </span>
        <span className="text-slate-300">vs</span>
        <span className={match.winnerTeamId === match.teamBId ? 'font-semibold text-slate-900' : 'text-slate-700'}>
          {isBye ? 'BYE' : teamName(match.teamBId)}
        </span>
      </div>
      <div className="text-xs flex items-center gap-2">
        {match.status === 'completed' && (
          <span className="text-slate-500">{match.teamAScore} - {match.teamBScore}</span>
        )}
        {match.status === 'scheduled' && <span className="text-slate-400">Scheduled</span>}
        {match.status === 'live' && <span className="text-emerald-600 font-medium">● LIVE</span>}
        {match.status === 'bye' && <span className="text-slate-400">Bye</span>}
        {match.status === 'forfeit' && <span className="text-red-500">Forfeit ({teamName(match.forfeitTeamId)})</span>}
        {isWatchable && <span className="text-orange-500 font-medium">View →</span>}
      </div>
    </div>
  )

  return isWatchable ? (
    <Link to={`/watch/${tournamentId}/match/${match.id}`} className="block hover:border-orange-400 rounded-lg transition">
      {content}
    </Link>
  ) : (
    content
  )
}

function EmptyState({ text }) {
  return (
    <div className="text-center text-slate-400 py-10 border border-dashed border-slate-200 rounded-xl">
      {text}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament } from '../../lib/adminData'
import {
  getMatchesForTournament,
  computeStandings,
  generateEliminationBracket,
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

  async function handleGenerateBracket() {
    if (!tournament?.formatConfig) return
    setGenerating(true)
    setError('')
    try {
      const { eliminationTeamsAdvancing, seedOrder } = tournament.formatConfig

      // Prefer live standings if any round-robin games are completed;
      // otherwise fall back to the saved seed order.
      const hasCompletedGames = roundRobinMatches.some((m) => m.status === 'completed')
      const orderedIds = hasCompletedGames
        ? standings.map((s) => s.team.id)
        : (seedOrder ?? teams.map((t) => t.id))

      await generateEliminationBracket(tournamentId, orderedIds, eliminationTeamsAdvancing)
      await refresh()
      setTab('bracket')
    } catch (err) {
      console.error('Failed to generate bracket:', err)
      setError('Could not generate the bracket. Check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (!tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-slate-500">
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
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/basketball/${tournamentId}`} className="text-sm text-slate-400 hover:text-slate-600">
        ← Back to teams
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-1 mb-4">{tournament.name}</h1>

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
        <div>
          {standings.length === 0 ? (
            <EmptyState text="No teams yet." />
          ) : (
            <div className="overflow-x-auto">
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
                      <td className="py-2 pr-2 text-center">
                        {(s.winPct * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={handleGenerateBracket}
            disabled={generating || roundRobinMatches.length === 0}
            className="w-full mt-6 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 transition disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Elimination Bracket'}
          </button>
          {roundRobinMatches.length === 0 && (
            <p className="text-xs text-slate-400 text-center mt-2">
              Set up the format and generate a round-robin schedule first.
            </p>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-2">
          {roundRobinMatches.length === 0 ? (
            <EmptyState text="No round-robin schedule yet. Set it up in Tournament Format." />
          ) : (
            roundRobinMatches.map((m) => <MatchRow key={m.id} match={m} teamName={teamName} />)
          )}
        </div>
      )}

      {tab === 'bracket' && (
        <div className="space-y-4">
          {playInMatches.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Play-in</h3>
              <div className="space-y-2">
                {playInMatches.map((m) => (
                  <MatchRow key={m.id} match={m} teamName={teamName} />
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
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Round {round}
                  </h3>
                  <div className="space-y-2">
                    {roundMatches.map((m) => (
                      <MatchRow key={m.id} match={m} teamName={teamName} />
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match, teamName }) {
  const isBye = match.status === 'bye'
  return (
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
      <div className="text-xs">
        {match.status === 'completed' && (
          <span className="text-slate-500">
            {match.teamAScore} - {match.teamBScore}
          </span>
        )}
        {match.status === 'scheduled' && <span className="text-slate-400">Scheduled</span>}
        {match.status === 'live' && <span className="text-emerald-600 font-medium">● LIVE</span>}
        {match.status === 'bye' && <span className="text-slate-400">Bye</span>}
        {match.status === 'forfeit' && <span className="text-red-500">Forfeit</span>}
      </div>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="text-center text-slate-400 py-10 border border-dashed border-slate-200 rounded-xl">
      {text}
    </div>
  )
}

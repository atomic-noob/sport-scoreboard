import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournament } from '../../lib/adminData'
import { PlayerLeaderboards, TeamLeaderboards } from './LeaderboardPanels'
import { getSportConfig } from '../../lib/sportConfig'

export default function TournamentLeaderboard() {
  const { tournamentId, sport: sportParam } = useParams() // tournamentId undefined = global/career view
  const isGlobal = !tournamentId

  const [tournament, setTournament] = useState(null)
  const [section, setSection] = useState('players') // 'players' | 'teams'
  const [error, setError] = useState('')

  useEffect(() => {
    if (tournamentId) {
      getTournament(tournamentId)
        .then(setTournament)
        .catch((err) => {
          console.error('Failed to load tournament:', err)
          setError('Could not load this tournament.')
        })
    }
  }, [tournamentId])

  const sportConfig = getSportConfig(tournament?.sport ?? sportParam)
  const sport = sportConfig.key

  if (tournamentId && !tournament) {
    return (
      <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-10 text-ink-dim">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        ) : (
          'Loading...'
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link
        to={tournamentId ? `/${sport}/${tournamentId}/schedule` : `/${sport}`}
        className="text-sm text-ink-faint hover:text-ink-dim"
      >
        ← {tournamentId ? 'Back to schedule' : 'Back to tournaments'}
      </Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1">
        {isGlobal ? 'Global Leaderboard' : `${tournament.name} Leaderboard`}
      </h1>
      <p className="text-ink-dim text-sm mb-6">
        {isGlobal
          ? 'Career stats across every tournament a player has ever played.'
          : 'Stats for this tournament only.'}
      </p>

      {!isGlobal && (
        <Link to={`/${sport}/leaderboard`} className="text-xs text-accent hover:text-accent font-medium">
          View global/career leaderboard instead →
        </Link>
      )}

      <div className="flex gap-2 my-6 border-b border-line">
        {['players', 'teams'].map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            disabled={s === 'teams' && isGlobal}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize disabled:opacity-30 disabled:cursor-not-allowed ${
              section === s
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-faint hover:text-ink-dim'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {section === 'teams' && isGlobal && (
        <p className="text-xs text-ink-faint -mt-4 mb-4">
          Team boards aren't available globally, since teams belong to a single tournament.
        </p>
      )}

      {section === 'players' ? (
        sportConfig.hasPlayerStats ? (
          <PlayerLeaderboards tournamentId={tournamentId} tournament={tournament} sportConfig={sportConfig} />
        ) : (
          <div className="text-center text-ink-faint py-10 border border-dashed border-line rounded-xl">
            Player stats aren't tracked for {sportConfig.label.toLowerCase()} yet.
          </div>
        )
      ) : (
        <TeamLeaderboards tournamentId={tournamentId} sportConfig={sportConfig} />
      )}
    </div>
  )
}

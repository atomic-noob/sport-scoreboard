import { Trophy, Lock } from 'lucide-react'
import SportIcon from '../../components/SportIcon'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTournaments } from '../../lib/adminData'
import { SPORTS } from '../../lib/sportConfig'
import { useAuth } from '../../context/AuthContext'


// Short one-line rules summary for the list rows.
function shortRules(sport, rules) {
  if (!rules) return null
  if (sport === 'volleyball') {
    const setsToWin = rules.setsToWin ?? 2
    return `Best of ${setsToWin * 2 - 1} · sets to ${rules.pointsPerSet ?? 25}`
  }
  return `${rules.quarterMinutes}min quarters · foul-out at ${rules.foulLimit}`
}

export default function TournamentHome() {
  const { sport } = useParams()
  const sportConfig = SPORTS[sport]
  const { user } = useAuth()

  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sportConfig) return
    setLoading(true)
    setError('')
    getTournaments({ sport })
      .then((all) => setTournaments(all.filter((t) => user?.id && t.createdBy === user.id)))
      .catch((err) => {
        console.error('Failed to load tournaments:', err)
        setError('Could not load tournaments. Check your connection and try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [sport, user?.id])

  if (!sportConfig) {
    return (
      <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/dashboard" className="text-sm text-ink-faint hover:text-ink-dim">
          ← Back to sports
        </Link>
        <div className="text-center text-ink-faint py-16 border border-dashed border-line rounded-xl mt-4">
          This sport isn't available yet.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/dashboard" className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to sports
      </Link>
      <div className="flex items-center justify-between mt-3 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink">
          <span className="inline-flex items-center gap-1.5"><SportIcon sport={sport} className="w-4 h-4" />{sportConfig.label}</span>
        </h1>
        <div className="flex items-center gap-3">
          <Link
            to={`/${sport}/leaderboard`}
            className="text-sm font-medium text-ink-faint hover:text-accent"
          >
            <span className="inline-flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Global Leaderboard</span>
          </Link>
          <Link
            to={`/${sport}/new`}
            className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-sm font-medium px-4 py-2 transition"
          >
            + New Tournament
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-ink-faint text-sm py-6 text-center">Loading...</p>
      ) : tournaments.length === 0 ? (
        <div className="text-center text-ink-faint py-16 border border-dashed border-line rounded-xl">
          You haven't created any {sportConfig.label.toLowerCase()} tournaments yet. Create your first one to get started.
          <div className="text-xs mt-2">Looking for other leagues? Browse them on the public scoreboard.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent hover:shadow-sm transition"
            >
              <Link to={`/${sport}/${t.id}`} className="flex-1">
                <div className="font-medium text-ink">{t.name}</div>
                <div className="text-xs text-ink-faint mt-0.5">
                  {shortRules(sport, t.rules)}
                  {t.level && <> · {t.level}</>}
                  {t.startDate && <> · starts {t.startDate}</>}
                  {t.pin && <span className="inline-flex items-center gap-1"> · <Lock className="w-3 h-3" /> PIN protected</span>}
                  {t.verificationStatus && t.verificationStatus !== 'unverified' && (
                    <span className="text-accent"> · {t.verificationStatus}</span>
                  )}
                </div>
              </Link>
              <Link
                to={`/${sport}/${t.id}/edit`}
                className="text-xs font-medium text-ink-faint hover:text-accent px-2 py-1"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

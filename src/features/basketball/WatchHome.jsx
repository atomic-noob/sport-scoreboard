import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTournaments } from '../../lib/adminData'

export default function WatchHome() {
  const [tournaments, setTournaments] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getTournaments()
      .then(setTournaments)
      .catch((err) => {
        console.error('Failed to load tournaments:', err)
        setError('Could not load tournaments. Check your connection and try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = tournaments.filter((t) =>
    t.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-panel">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-ink">📺 Watch Live</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink mb-1">Find a tournament</h1>
        <p className="text-ink-dim text-sm mb-6">
          Browse live scores, schedules, and standings -- no account needed.
        </p>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournament name..."
          className="w-full rounded-lg border border-line-strong px-4 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-accent"
        />

        {error && (
          <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-ink-faint text-center py-10">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center text-ink-faint py-16 border border-dashed border-line rounded-xl">
            {tournaments.length === 0 ? 'No tournaments yet.' : 'No tournaments match your search.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <Link
                key={t.id}
                to={`/watch/${t.id}`}
                className="block rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent hover:shadow-sm transition"
              >
                <div className="font-medium text-ink">{t.name}</div>
                <div className="text-xs text-ink-faint mt-0.5">
                  {t.sport === 'basketball' ? '🏀' : ''} {t.sport}
                  {t.startDate && <> · starts {t.startDate}</>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

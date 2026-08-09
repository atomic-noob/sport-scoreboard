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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-slate-900">📺 Watch Live</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Find a tournament</h1>
        <p className="text-slate-500 text-sm mb-6">
          Browse live scores, schedules, and standings -- no account needed.
        </p>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournament name..."
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-400 text-center py-10">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-16 border border-dashed border-slate-200 rounded-xl">
            {tournaments.length === 0 ? 'No tournaments yet.' : 'No tournaments match your search.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <Link
                key={t.id}
                to={`/watch/${t.id}`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-orange-400 hover:shadow-sm transition"
              >
                <div className="font-medium text-slate-800">{t.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
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

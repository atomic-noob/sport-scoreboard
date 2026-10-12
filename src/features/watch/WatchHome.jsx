import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTournaments, getEvents } from '../../lib/adminData'
import { Tv, Layers, Check } from 'lucide-react'
import { SPORT_LIST, getSportConfig } from '../../lib/sportConfig'
import SportIcon from '../../components/SportIcon'

export default function WatchHome() {
  const [tournaments, setTournaments] = useState([])
  const [events, setEvents] = useState([])
  const [query, setQuery] = useState('')
  const [sportFilter, setSportFilter] = useState('all')
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

  // Events are optional: if the table doesn't exist yet, just show none.
  useEffect(() => {
    getEvents().then(setEvents).catch(() => setEvents([]))
  }, [])

  const eventName = new Map(events.map((e) => [e.id, e.name]))
  const filteredEvents = events.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))

  const filtered = tournaments.filter(
    (t) =>
      (sportFilter === 'all' || t.sport === sportFilter) &&
      t.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-line bg-panel">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-bold text-ink"><Tv className="w-4 h-4" /> Watch live</span>
          <Link to="/" className="text-xs text-ink-dim hover:text-ink">
            Sylve home →
          </Link>
        </div>
      </header>

      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink mb-1">Find a tournament</h1>
        <p className="text-ink-dim text-sm mb-6">
          Browse live scores, schedules, and standings -- no account needed.
        </p>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournament name..."
          className="w-full rounded-lg border border-line-strong px-4 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
        />

        <div className="flex flex-wrap gap-1.5 mb-6">
          {[{ key: 'all', label: 'All sports' }, ...SPORT_LIST].map((s) => (
            <button
              key={s.key}
              onClick={() => setSportFilter(s.key)}
              className={`text-xs font-medium rounded-full px-3 py-1.5 transition ${
                sportFilter === s.key
                  ? 'bg-accent text-on-accent'
                  : 'bg-panel border border-line text-ink-dim hover:border-accent'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {s.key !== 'all' && <SportIcon sport={s.key} className="w-3.5 h-3.5" />}
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {filteredEvents.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-ink-dim mb-2">Events</h2>
            <div className="space-y-2">
              {filteredEvents.map((ev) => (
                <Link
                  key={ev.id}
                  to={`/watch/events/${ev.id}`}
                  className="block rounded-lg border border-accent bg-accent-soft px-4 py-3 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2 font-medium text-ink"><Layers className="w-4 h-4 text-accent" /> {ev.name}</div>
                  <div className="text-xs text-ink-faint mt-0.5">
                    Multi-sport event{ev.startDate && <> · starts {ev.startDate}</>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

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
            {filtered.map((t) => {
              const cfg = getSportConfig(t.sport)
              return (
                <Link
                  key={t.id}
                  to={`/watch/${t.id}`}
                  className="block rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent hover:shadow-sm transition"
                >
                  <div className="font-medium text-ink">{t.name}</div>
                  <div className="text-xs text-ink-faint mt-0.5">
                    <span className="inline-flex items-center gap-1 align-middle"><SportIcon sport={t.sport} className="w-3 h-3" />{cfg.label}</span>
                    {t.level && <> · {t.level}</>}
                    {t.startDate && <> · starts {t.startDate}</>}
                    {t.eventId && eventName.get(t.eventId) && <> · {eventName.get(t.eventId)}</>}
                    {t.verificationStatus && t.verificationStatus !== 'unverified' && (
                      <span className="text-accent"> · verified: {t.verificationStatus}</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

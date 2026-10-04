import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEvent, getTournamentsForEvent } from '../../lib/adminData'
import { SPORT_LIST, getSportConfig } from '../../lib/sportConfig'

export default function WatchEvent() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getEvent(eventId), getTournamentsForEvent(eventId)])
      .then(([ev, ts]) => { setEvent(ev); setTournaments(ts) })
      .catch((err) => {
        console.error('Failed to load event:', err)
        setError('Could not load this event.')
      })
  }, [eventId])

  if (!event) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        ) : (
          <p className="text-ink-faint">Loading...</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-panel">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          <Link to="/watch" className="text-sm text-ink-faint hover:text-ink-dim">← All tournaments</Link>
        </div>
      </header>

      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-display font-bold tracking-wide text-ink mb-1">{event.name}</h1>
        {event.description && <p className="text-ink-dim text-sm mb-1">{event.description}</p>}
        {event.startDate && <p className="text-xs text-ink-faint mb-4">Starts {event.startDate}</p>}

        {tournaments.length === 0 && (
          <div className="text-center text-ink-faint py-16 border border-dashed border-line rounded-xl mt-4">
            No tournaments in this event yet.
          </div>
        )}

        {SPORT_LIST.map((s) => {
          const list = tournaments.filter((t) => t.sport === s.key)
          if (list.length === 0) return null
          return (
            <section key={s.key} className="mt-6">
              <h2 className="font-medium text-ink mb-2">{s.emoji} {s.label}</h2>
              <div className="space-y-2">
                {list.map((t) => (
                  <Link
                    key={t.id}
                    to={`/watch/${t.id}`}
                    className="block rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent hover:shadow-sm transition"
                  >
                    <div className="font-medium text-ink">{t.name}</div>
                    <div className="text-xs text-ink-faint mt-0.5">
                      {getSportConfig(t.sport).label}
                      {t.level && <> · {t.level}</>}
                      {t.startDate && <> · starts {t.startDate}</>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

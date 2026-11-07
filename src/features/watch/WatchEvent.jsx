import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, Layers } from 'lucide-react'
import { getEvent, getTournamentsForEvent } from '../../lib/adminData'
import { SPORT_LIST, getSportConfig } from '../../lib/sportConfig'
import SportIcon from '../../components/SportIcon'

const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'
const BG = { background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }

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
      <div className="min-h-screen flex items-center justify-center px-4" style={BG}>
        {error ? (
          <div className="rounded-xl border border-live bg-live-soft px-4 py-2.5 text-sm text-live">{error}</div>
        ) : (
          <p className="text-white/40">Loading...</p>
        )}
      </div>
    )
  }

  const sports = SPORT_LIST.filter((s) => tournaments.some((t) => t.sport === s.key))

  return (
    <div className="min-h-screen text-white" style={BG}>
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link to="/watch" className="text-sm text-white/50 hover:text-white/80">← All tournaments</Link>
          <span className="font-display font-bold tracking-wide text-emerald-400">Sylve</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-start gap-4 mb-3">
          <span className="w-12 h-12 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-wide break-words">{event.name}</h1>
            {event.description && <p className="text-white/60 mt-1">{event.description}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-white/50">
              {event.startDate && <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Starts {event.startDate}</span>}
              {tournaments.length > 0 && <span>{tournaments.length} {tournaments.length === 1 ? 'tournament' : 'tournaments'} across {sports.length} {sports.length === 1 ? 'sport' : 'sports'}</span>}
            </div>
          </div>
        </div>

        {tournaments.length === 0 && (
          <div className="text-center text-white/50 py-16 border border-dashed border-white/15 rounded-2xl mt-8">
            No tournaments in this event yet.
          </div>
        )}

        {sports.map((s) => {
          const list = tournaments.filter((t) => t.sport === s.key)
          return (
            <section key={s.key} className="mt-8">
              <h2 className="flex items-center gap-2.5 font-medium mb-3">
                <span className="w-9 h-9 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
                  <SportIcon sport={s.key} className="w-5 h-5" />
                </span>
                {s.label}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {list.map((t) => (
                  <Link
                    key={t.id}
                    to={`/watch/${t.id}`}
                    className={`${glass} group flex items-center gap-3 px-5 py-4 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/40 hover:bg-emerald-400/5`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {getSportConfig(t.sport).label}
                        {t.level && <> · {t.level}</>}
                        {t.startDate && <> · starts {t.startDate}</>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-400 transition group-hover:translate-x-1" />
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

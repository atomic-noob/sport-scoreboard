import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, Layers, Plus } from 'lucide-react'
import { createEvent, getEvents, getTournaments } from '../../lib/adminData'
import { SPORT_LIST } from '../../lib/sportConfig'
import SportIcon from '../../components/SportIcon'

const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'
const inputCls =
  'w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/60'

export default function EventsHome() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getEvents(), getTournaments().catch(() => [])])
      .then(([evs, ts]) => { setEvents(evs); setTournaments(ts) })
      .catch((err) => {
        console.error('Failed to load events:', err)
        setError('Could not load events. Make sure the events SQL has been run in Supabase, then refresh.')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const ev = await createEvent({ name: name.trim(), startDate: startDate || null })
      navigate(`/events/${ev.id}`)
    } catch (err) {
      console.error('Failed to create event:', err)
      setError('Could not create this event. Check your connection and that the events SQL has been run.')
    } finally {
      setSaving(false)
    }
  }

  function summary(eventId) {
    const list = tournaments.filter((t) => t.eventId === eventId)
    const sports = SPORT_LIST.filter((s) => list.some((t) => t.sport === s.key))
    return { count: list.length, sports }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full relative overflow-hidden text-white">
      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />
      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <Link to="/dashboard" className="text-sm text-white/40 hover:text-white/70">← Back</Link>
        <div className="flex items-center gap-4 mt-3 mb-2">
          <span className="w-12 h-12 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-wide">Events</h1>
        </div>
        <p className="text-white/60 mb-8 max-w-xl">
          An event groups tournaments from different sports under one name and one public link. Perfect for a sports fest.
        </p>

        <form onSubmit={handleCreate} className={`${glass} p-5 mb-8`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Create an event</div>
          <div className="grid sm:grid-cols-[1fr_190px_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Event name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barangay Sports Fest 2026" className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-5 py-2.5 text-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-5 rounded-xl border border-live bg-live-soft px-4 py-2.5 text-sm text-live">{error}</div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Your events</h2>
        {loading ? (
          <p className="text-white/40 text-center py-10">Loading...</p>
        ) : events.length === 0 ? (
          <div className="text-center text-white/50 py-14 border border-dashed border-white/15 rounded-2xl">
            No events yet. Create your first one above.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {events.map((ev) => {
              const { count, sports } = summary(ev.id)
              return (
                <Link
                  key={ev.id}
                  to={`/events/${ev.id}`}
                  className={`${glass} group p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-400/5 hover:shadow-lg hover:shadow-emerald-500/10`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display font-bold tracking-wide text-xl truncate">{ev.name}</div>
                      {ev.startDate && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50 mt-1">
                          <CalendarDays className="w-3.5 h-3.5" /> Starts {ev.startDate}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-emerald-400 shrink-0 mt-1 transition group-hover:translate-x-1" />
                  </div>
                  <div className="flex items-center gap-2 mt-4 min-h-8">
                    {sports.length === 0 ? (
                      <span className="text-xs text-white/40">No tournaments yet</span>
                    ) : (
                      <>
                        {sports.map((s) => (
                          <span key={s.key} title={s.label} className="w-8 h-8 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
                            <SportIcon sport={s.key} className="w-4 h-4" />
                          </span>
                        ))}
                        <span className="text-xs text-white/50 ml-1">{count} {count === 1 ? 'tournament' : 'tournaments'}</span>
                      </>
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

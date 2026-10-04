import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createEvent, getEvents } from '../../lib/adminData'

export default function EventsHome() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getEvents()
      .then(setEvents)
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

  const inputCls =
    'w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/dashboard" className="text-sm text-ink-faint hover:text-ink-dim">← Back</Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1">Events</h1>
      <p className="text-ink-dim text-sm mb-6">
        An event groups tournaments from different sports under one name and one public link.
      </p>

      <form onSubmit={handleCreate} className="rounded-xl border border-line bg-panel p-4 mb-6 space-y-3">
        <div className="text-sm font-medium text-ink">Create an event</div>
        <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1">Event name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Barangay Sports Fest 2026"
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-4 py-2 text-sm transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
      )}

      {loading ? (
        <p className="text-ink-faint text-center py-10">Loading...</p>
      ) : events.length === 0 ? (
        <div className="text-center text-ink-faint py-12 border border-dashed border-line rounded-xl">No events yet.</div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <Link
              key={ev.id}
              to={`/events/${ev.id}`}
              className="block rounded-lg border border-line bg-panel px-4 py-3 hover:border-accent hover:shadow-sm transition"
            >
              <div className="font-medium text-ink">{ev.name}</div>
              {ev.startDate && <div className="text-xs text-ink-faint mt-0.5">starts {ev.startDate}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

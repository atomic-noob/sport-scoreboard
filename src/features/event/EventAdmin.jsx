import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getEvent, updateEvent, deleteEvent, getTournaments, setTournamentEvent,
} from '../../lib/adminData'
import { ArrowRight, CalendarDays, Layers, Plus, Tv } from 'lucide-react'
import { SPORT_LIST, getSportConfig } from '../../lib/sportConfig'
import SportIcon from '../../components/SportIcon'

export default function EventAdmin() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [all, setAll] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', startDate: '' })
  const [attachId, setAttachId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const [ev, tournaments] = await Promise.all([getEvent(eventId), getTournaments()])
      setEvent(ev)
      setAll(tournaments)
    } catch (err) {
      console.error('Failed to load event:', err)
      setError('Could not load this event. Check your connection and try refreshing.')
    }
  }

  useEffect(() => { refresh() }, [eventId])

  if (!event) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-white/60">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        ) : 'Loading...'}
      </div>
    )
  }

  const isOwner = user?.id && event.createdBy === user.id
  const inEvent = all.filter((t) => t.eventId === eventId)
  // Only tournaments the user owns and that aren't already in an event can be attached.
  const attachable = all.filter((t) => !t.eventId && t.createdBy === user?.id)

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (err) {
      console.error(err)
      setError('That did not work. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    setForm({ name: event.name, description: event.description ?? '', startDate: event.startDate ?? '' })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    await run(async () => {
      await updateEvent(eventId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        startDate: form.startDate || null,
      })
      setEditing(false)
    })
  }

  async function handleDelete() {
    if (!window.confirm('Delete this event? Its tournaments are kept, just ungrouped.')) return
    setBusy(true)
    try {
      await deleteEvent(eventId)
      navigate('/events')
    } catch (err) {
      console.error(err)
      setError('Could not delete this event.')
      setBusy(false)
    }
  }

  const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'
  const inputCls =
    'w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/60'

  const EVENT_SPORTS = ['basketball', 'basketball3x3', 'volleyball', 'badminton', 'pickleball', 'tennis', 'tabletennis']
  const sportList = SPORT_LIST.filter((s) => EVENT_SPORTS.includes(s.key))

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full relative overflow-hidden text-white">
      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />
      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <Link to="/events" className="text-sm text-white/40 hover:text-white/70">← All events</Link>

        {editing ? (
          <form onSubmit={saveEdit} className={`${glass} p-5 mt-3 mb-8 space-y-3`}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className={inputCls}
            />
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
            <div className="flex gap-2">
              <button disabled={busy} className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-5 py-2.5 disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-white/15 text-white/70 text-sm px-5 py-2.5 hover:bg-white/5">Cancel</button>
            </div>
          </form>
        ) : (
          <div className={`${glass} p-5 sm:p-6 mt-3 mb-8`}>
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6" />
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-wide break-words">{event.name}</h1>
                {event.description && <p className="text-white/60 text-sm mt-1">{event.description}</p>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-white/50">
                  {event.startDate && <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Starts {event.startDate}</span>}
                  <span>{inEvent.length} {inEvent.length === 1 ? 'tournament' : 'tournaments'}</span>
                </div>
              </div>
              {isOwner && (
                <button onClick={startEdit} className="text-sm font-medium text-white/50 hover:text-emerald-300 shrink-0">Edit event</button>
              )}
            </div>
            <a
              href={`/watch/events/${eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 transition"
            >
              <Tv className="w-4 h-4" /> Open public page
            </a>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-live bg-live-soft px-4 py-2.5 text-sm text-live">{error}</div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {sportList.map((s) => {
            const list = inEvent.filter((t) => t.sport === s.key)
            return (
              <section key={s.key} className={`${glass} p-4`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="flex items-center gap-2.5 font-medium">
                    <span className="w-9 h-9 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
                      <SportIcon sport={s.key} className="w-5 h-5" />
                    </span>
                    {s.label}
                  </h2>
                  {isOwner && (
                    <Link to={`/${s.key}/new?event=${eventId}`} className="flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">
                      <Plus className="w-3.5 h-3.5" /> New
                    </Link>
                  )}
                </div>
                {list.length === 0 ? (
                  <div className="text-sm text-white/40 border border-dashed border-white/15 rounded-xl px-4 py-4 text-center">
                    No {s.label.toLowerCase()} tournament yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {list.map((t) => (
                      <div key={t.id} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 hover:border-emerald-400/40 transition">
                        <Link to={`/${getSportConfig(t.sport).key}/${t.id}`} className="flex-1 min-w-0">
                          <div className="font-medium truncate">{t.name}</div>
                          {t.startDate && <div className="text-xs text-white/40">starts {t.startDate}</div>}
                        </Link>
                        {isOwner && t.createdBy === user?.id && (
                          <button
                            disabled={busy}
                            onClick={() => run(() => setTournamentEvent(t.id, null))}
                            className="text-xs text-white/40 hover:text-live disabled:opacity-50"
                          >
                            Detach
                          </button>
                        )}
                        <ArrowRight className="w-4 h-4 text-emerald-400 transition group-hover:translate-x-0.5" />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {isOwner && (
          <section className={`${glass} p-5 mb-6`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Add an existing tournament</div>
            {attachable.length === 0 ? (
              <p className="text-sm text-white/50">You have no ungrouped tournaments to add.</p>
            ) : (
              <div className="flex gap-2">
                <select value={attachId} onChange={(e) => setAttachId(e.target.value)} className={inputCls}>
                  <option value="">Choose a tournament…</option>
                  {attachable.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({getSportConfig(t.sport).label})
                    </option>
                  ))}
                </select>
                <button
                  disabled={!attachId || busy}
                  onClick={() => run(async () => { await setTournamentEvent(attachId, eventId); setAttachId('') })}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-5 py-2.5 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </section>
        )}

        {isOwner && (
          <button onClick={handleDelete} disabled={busy} className="text-sm text-white/40 hover:text-live">
            Delete event
          </button>
        )}
      </div>
    </div>
  )
}

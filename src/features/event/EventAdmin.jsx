import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getEvent, updateEvent, deleteEvent, getTournaments, setTournamentEvent,
} from '../../lib/adminData'
import { SPORT_LIST, getSportConfig } from '../../lib/sportConfig'

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
      <div className="max-w-2xl mx-auto px-4 py-10 text-ink-dim">
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

  const inputCls =
    'w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/events" className="text-sm text-ink-faint hover:text-ink-dim">← All events</Link>

      {editing ? (
        <form onSubmit={saveEdit} className="rounded-xl border border-line bg-panel p-4 mt-2 mb-6 space-y-3">
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
            <button disabled={busy} className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-sm font-medium px-4 py-2 disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line text-ink-dim text-sm px-4 py-2">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="mt-1 mb-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-display font-bold tracking-wide text-ink">{event.name}</h1>
            {isOwner && (
              <button onClick={startEdit} className="text-sm font-medium text-ink-faint hover:text-accent shrink-0">Edit event</button>
            )}
          </div>
          {event.description && <p className="text-ink-dim text-sm mt-1">{event.description}</p>}
          {event.startDate && <p className="text-xs text-ink-faint mt-1">Starts {event.startDate}</p>}
          <a
            href={`/watch/events/${eventId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm font-medium text-accent hover:text-accent-strong"
          >
            📺 Open public page →
          </a>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
      )}

      {SPORT_LIST.filter((s) => s.key === 'basketball' || s.key === 'volleyball').map((s) => {
        const list = inEvent.filter((t) => t.sport === s.key)
        return (
          <section key={s.key} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-ink">{s.emoji} {s.label}</h2>
              {isOwner && (
                <Link to={`/${s.key}/new?event=${eventId}`} className="text-sm font-medium text-accent hover:text-accent-strong">
                  ＋ New {s.label.toLowerCase()} tournament
                </Link>
              )}
            </div>
            {list.length === 0 ? (
              <div className="text-sm text-ink-faint border border-dashed border-line rounded-lg px-4 py-4 text-center">
                No {s.label.toLowerCase()} tournament yet.
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3">
                    <Link to={`/${getSportConfig(t.sport).key}/${t.id}`} className="flex-1 min-w-0 hover:text-accent">
                      <div className="font-medium text-ink truncate">{t.name}</div>
                      {t.startDate && <div className="text-xs text-ink-faint">starts {t.startDate}</div>}
                    </Link>
                    {isOwner && t.createdBy === user?.id && (
                      <button
                        disabled={busy}
                        onClick={() => run(() => setTournamentEvent(t.id, null))}
                        className="text-xs text-ink-faint hover:text-live disabled:opacity-50"
                      >
                        Detach
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {isOwner && (
        <section className="rounded-xl border border-line bg-panel p-4 mb-6">
          <div className="text-sm font-medium text-ink mb-2">Add an existing tournament</div>
          {attachable.length === 0 ? (
            <p className="text-sm text-ink-faint">You have no ungrouped tournaments to add.</p>
          ) : (
            <div className="flex gap-2">
              <select value={attachId} onChange={(e) => setAttachId(e.target.value)} className={inputCls}>
                <option value="">Choose a tournament…</option>
                {attachable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getSportConfig(t.sport).emoji} {t.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!attachId || busy}
                onClick={() => run(async () => { await setTournamentEvent(attachId, eventId); setAttachId('') })}
                className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-sm font-medium px-4 py-2 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </section>
      )}

      {isOwner && (
        <button onClick={handleDelete} disabled={busy} className="text-sm text-ink-faint hover:text-live">
          Delete event
        </button>
      )}
    </div>
  )
}

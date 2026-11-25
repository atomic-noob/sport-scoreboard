import { useEffect, useState } from 'react'
import AdminGate from './AdminGate'
import { getActiveAnnouncement, setAnnouncement } from '../../lib/adminTools'

function Body() {
  const [message, setMessage] = useState('')
  const [active, setActive] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    getActiveAnnouncement().then((a) => { if (a) { setMessage(a.message); setActive(a.active) } setLoaded(true) })
  }, [])

  async function save(nextActive) {
    setBusy(true)
    setNote('')
    try {
      await setAnnouncement(message.trim(), nextActive)
      setActive(nextActive)
      setNote(nextActive ? 'Saved. The banner is showing on every page.' : 'Saved. The banner is off.')
    } catch (e) {
      setNote(e.message + ' Check that supabase/admin-tools.sql was run.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <p className="mt-6 text-ink-dim">Loading...</p>
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-ink-dim">A short notice shown at the top of every page, for example about maintenance or a new feature. Plain text only.</p>
      <div>
        <label htmlFor="ann" className="block text-sm font-medium mb-1">Message <span className="text-ink-faint font-normal">({message.length}/280)</span></label>
        <textarea id="ann" rows={3} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" placeholder="Sylve will be down for a few minutes tonight at 10 PM." />
      </div>
      {message.trim() && (
        <div>
          <p className="text-xs text-ink-faint mb-1">Preview</p>
          <div className="rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm text-accent text-center">{message}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !message.trim()} onClick={() => save(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-50">{active ? 'Update banner' : 'Show banner'}</button>
        {active && <button type="button" disabled={busy} onClick={() => save(false)} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-dim hover:text-ink disabled:opacity-50">Turn off</button>}
      </div>
      <p className="text-xs text-ink-faint">Status: {active ? 'showing' : 'off'}</p>
      {note && <p role="status" className="text-sm text-ink-dim">{note}</p>}
    </div>
  )
}

export default function AdminAnnouncement() {
  return <AdminGate title="Announcement banner"><Body /></AdminGate>
}

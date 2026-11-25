import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminGate from './AdminGate'
import { listAllTournaments, setVerification } from '../../lib/adminTools'
import { SPORTS } from '../../lib/sportConfig'

const STATUSES = [
  ['unverified', 'Unverified'],
  ['pending', 'Pending'],
  ['verified', 'Verified'],
  ['official', 'Official'],
]

function Body() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('pending')

  useEffect(() => { listAllTournaments().then(setRows).catch((e) => setError(e.message)) }, [])

  async function change(id, status) {
    const before = rows
    setError('')
    setRows((xs) => xs.map((x) => (x.id === id ? { ...x, verification_status: status } : x)))
    try { await setVerification(id, status) } catch (e) { setRows(before); setError(e.message) }
  }

  if (error && !rows) return <p className="mt-6 text-live">{error} Check that supabase/admin-tools.sql was run.</p>
  if (!rows) return <p className="mt-6 text-ink-dim">Loading...</p>

  const shown = rows.filter((r) => filter === 'all' || (r.verification_status || 'unverified') === filter)
  return (
    <>
      <p className="mt-1 text-sm text-ink-dim">Check who is running a tournament, then mark it Verified or Official so players know it is real.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter">
        {[['pending', 'Pending'], ['unverified', 'Unverified'], ['verified', 'Verified'], ['official', 'Official'], ['all', 'All']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === v ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-dim hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-live">{error}</p>}
      {shown.length === 0 && <p className="mt-8 text-ink-dim">Nothing here.</p>}
      <ul className="mt-5 space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link to={`/watch/${r.id}`} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-accent">{r.name}</Link>
              <span className="text-xs text-ink-faint">{SPORTS[r.sport]?.label ?? r.sport}</span>
            </div>
            <p className="mt-1 text-xs text-ink-dim">
              {r.owner_email || 'Unknown organizer'}
              {r.organizer_type && <> &middot; {r.organizer_type}</>}
              {r.level && <> &middot; {r.level}</>}
              {r.start_date && <> &middot; starts {r.start_date}</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map(([v, l]) => (
                <button key={v} type="button" disabled={(r.verification_status || 'unverified') === v} onClick={() => change(r.id, v)} className={`rounded-md border px-2.5 py-1 text-xs ${(r.verification_status || 'unverified') === v ? 'border-accent text-accent' : 'border-line-strong text-ink-dim hover:text-ink'}`}>{l}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function AdminVerify() {
  return <AdminGate title="Verify organizers"><Body /></AdminGate>
}

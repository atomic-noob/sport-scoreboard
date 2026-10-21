import { useEffect, useState } from 'react'
import { searchPlayers } from '../../lib/adminData'

/**
 * Pick an existing Sylve player (search by name or SYL- code) or create a new
 * one by name. value: { id, name } for an existing player, { id: null, name }
 * for one that will be created when the entry is saved, or null.
 */
export default function PlayerPicker({ label, value, onChange, excludeIds = [] }) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setMatches([])
      return undefined
    }
    setSearching(true)
    const timeout = setTimeout(async () => {
      try {
        setMatches(await searchPlayers(query))
      } catch {
        setMatches([])
      } finally {
        setSearching(false)
      }
    }, 200)
    return () => clearTimeout(timeout)
  }, [query])

  if (value) {
    return (
      <div>
        <label className="block text-xs font-medium text-ink-dim mb-1">{label}</label>
        <div className="flex items-center justify-between rounded-lg border border-line-strong bg-panel-alt px-3 py-2">
          <span className="text-sm text-ink truncate">
            {value.name}
            {!value.id && <span className="text-xs text-accent"> · new player</span>}
          </span>
          <button
            type="button"
            onClick={() => { onChange(null); setQuery('') }}
            className="text-xs text-ink-faint hover:text-ink-dim shrink-0 ml-2"
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  const typed = query.trim()
  return (
    <div>
      <label className="block text-xs font-medium text-ink-dim mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type a name, or a SYL- ID..."
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {typed && (
        <div className="mt-1 rounded-lg border border-line bg-panel max-h-48 overflow-y-auto">
          {searching && <p className="text-xs text-ink-faint px-3 py-2">Searching...</p>}
          {matches.filter((p) => !excludeIds.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange({ id: p.id, name: p.name }); setQuery('') }}
              className="w-full flex items-center justify-between text-left px-3 py-2 text-sm text-ink hover:bg-panel-alt"
            >
              <span>
                {p.name}
                {p.playerCode && <span className="text-ink-faint"> · {p.playerCode}</span>}
              </span>
              <span className="text-xs text-ink-faint">Existing player</span>
            </button>
          ))}
          {!searching && (
            <button
              type="button"
              onClick={() => { onChange({ id: null, name: typed }); setQuery('') }}
              className="w-full text-left px-3 py-2 text-sm text-ink-dim hover:bg-accent-soft"
            >
              <span className="font-medium text-accent">+ New player</span> "{typed}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

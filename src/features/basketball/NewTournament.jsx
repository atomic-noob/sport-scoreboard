import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTournament } from '../../lib/adminData'

export default function NewTournament() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [pin, setPin] = useState('')
  const [rules, setRules] = useState({
    quarterMinutes: 10,
    foulLimit: 5,
    otMinutes: 5,
    timeoutsPerTeam: 4,
    maxRosterSize: 15,
    avgStatMinGames: 3,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateRule(key, value) {
    setRules((r) => ({ ...r, [key]: Number(value) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const tournament = await createTournament({
        name: name.trim(),
        sport: 'basketball',
        rules,
        startDate: startDate || null,
        pin: pin.trim() || null,
      })
      navigate(`/basketball/${tournament.id}`)
    } catch (err) {
      console.error('Failed to create tournament:', err)
      setError(
        'Could not save this tournament. Check your internet connection and Supabase setup, then try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mb-1">New Basketball Tournament</h1>
      <p className="text-ink-dim mb-6 text-sm">
        Set the ground rules once — they apply to every game in this tournament, and can be
        overridden per-game later if needed.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink-dim mb-1">Tournament name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Barangay Summer League 2026"
            className="w-full rounded-lg border border-line-strong px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-ink-faint mt-1">Details lock once this date arrives</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1">
              Edit PIN <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="e.g. 1234"
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-ink-faint mt-1">Required to edit later</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <RuleInput
            label="Quarter length (min)"
            value={rules.quarterMinutes}
            onChange={(v) => updateRule('quarterMinutes', v)}
          />
          <RuleInput
            label="Foul limit (foul-out)"
            value={rules.foulLimit}
            onChange={(v) => updateRule('foulLimit', v)}
          />
          <RuleInput
            label="Overtime length (min)"
            value={rules.otMinutes}
            onChange={(v) => updateRule('otMinutes', v)}
          />
          <RuleInput
            label="Timeouts per team"
            value={rules.timeoutsPerTeam}
            onChange={(v) => updateRule('timeoutsPerTeam', v)}
          />
          <RuleInput
            label="Max roster size"
            value={rules.maxRosterSize}
            onChange={(v) => updateRule('maxRosterSize', v)}
          />
          <RuleInput
            label="Min games for avg stats"
            value={rules.avgStatMinGames}
            onChange={(v) => updateRule('avgStatMinGames', v)}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-accent-soft0 hover:bg-accent-strong text-white font-medium py-2.5 transition disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Tournament'}
        </button>
      </form>
    </div>
  )
}

function RuleInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-dim mb-1">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  )
}

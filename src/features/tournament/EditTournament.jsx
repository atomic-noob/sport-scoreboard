import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, updateTournament, isTournamentLocked } from '../../lib/adminData'
import { getSportConfig } from '../../lib/sportConfig'

const LEVELS = ['Casual / Community', 'Barangay', 'Municipal / City', 'Provincial', 'Regional', 'National', 'International', 'Official / Organization']
const ORGANIZER_TYPES = ['Individual', 'Barangay', 'School', 'Club', 'League', 'LGU', 'Sports Organization', 'Other']

const VERIFICATION_LABELS = {
  unverified: { text: 'Unverified', color: 'text-ink-faint' },
  pending: { text: 'Pending Verification', color: 'text-warn' },
  verified: { text: 'Verified', color: 'text-accent' },
  official: { text: 'Official', color: 'text-accent' },
}

export default function EditTournament() {
  const { tournamentId, sport: sportParam } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [pin, setPin] = useState('')
  const [level, setLevel] = useState('')
  const [organizerType, setOrganizerType] = useState('')
  const [rules, setRules] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getTournament(tournamentId)
      .then((t) => {
        setTournament(t)
        setName(t.name)
        setStartDate(t.startDate ?? '')
        setPin(t.pin ?? '')
        setLevel(t.level ?? '')
        setOrganizerType(t.organizerType ?? '')
        // Merge over the sport's defaults so older tournaments missing a rule key still render
        setRules({ ...getSportConfig(t.sport ?? sportParam).defaultRules, ...t.rules })
        // No PIN set on the tournament yet -- nothing to gate, go straight in
        if (!t.pin) setUnlocked(true)
      })
      .catch((err) => {
        console.error('Failed to load tournament:', err)
        setError('Could not load this tournament. Check your connection and try refreshing.')
      })
  }, [tournamentId])

  function updateRule(key, value) {
    setRules((r) => ({ ...r, [key]: Number(value) }))
  }

  function handlePinSubmit(e) {
    e.preventDefault()
    if (pinInput === tournament.pin) {
      setUnlocked(true)
      setPinError('')
    } else {
      setPinError('Incorrect PIN')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await updateTournament(tournamentId, {
        name: name.trim(),
        startDate: startDate || null,
        pin: pin.trim() || null,
        level: level || null,
        organizerType: organizerType || null,
        rules,
      })
      navigate(`/${getSportConfig(tournament.sport ?? sportParam).key}/${tournamentId}`)
    } catch (err) {
      console.error('Failed to save tournament:', err)
      setError('Could not save changes. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!tournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-ink-dim">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        ) : (
          'Loading...'
        )}
      </div>
    )
  }

  const sportConfig = getSportConfig(tournament.sport ?? sportParam)
  const sport = sportConfig.key
  const locked = isTournamentLocked(tournament)

  if (locked) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <Link to={`/${sport}/${tournamentId}`} className="text-sm text-ink-faint hover:text-ink-dim">
          ← Back
        </Link>
        <div className="mt-4 rounded-xl border border-line bg-panel p-6 text-center">
          <p className="text-ink-dim font-medium mb-1">This tournament has started</p>
          <p className="text-ink-dim text-sm">
            Details are locked once the start date arrives, so results stay consistent once
            games are underway.
          </p>
        </div>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto px-4 py-10">
        <Link to={`/${sport}/${tournamentId}`} className="text-sm text-ink-faint hover:text-ink-dim">
          ← Back
        </Link>
        <h1 className="text-xl font-display font-bold tracking-wide text-ink mt-1 mb-4">Enter PIN to edit</h1>
        <form onSubmit={handlePinSubmit} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
              setPinError('')
            }}
            placeholder="Enter PIN"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {pinError && <p className="text-xs text-live">{pinError}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 transition"
          >
            Unlock
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link to={`/${sport}/${tournamentId}`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back
      </Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1">Edit Tournament</h1>
      <p className={`text-xs font-medium mb-5 ${VERIFICATION_LABELS[tournament.verificationStatus]?.color ?? 'text-ink-faint'}`}>
        {VERIFICATION_LABELS[tournament.verificationStatus]?.text ?? 'Unverified'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink-dim mb-1">Tournament name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Not specified</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1">Organizer type</label>
            <select
              value={organizerType}
              onChange={(e) => setOrganizerType(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Not specified</option>
              {ORGANIZER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
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
              placeholder="Leave blank for none"
              className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {rules && (
          <div className="grid grid-cols-2 gap-4">
            {sportConfig.ruleFields.map((f) => (
              <RuleInput
                key={f.key}
                field={f}
                value={rules[f.key]}
                onChange={(v) => updateRule(f.key, v)}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

function RuleInput({ field, value, onChange }) {
  const cls =
    'w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent'
  return (
    <div>
      <label className="block text-xs font-medium text-ink-dim mb-1">{field.label}</label>
      {field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </div>
  )
}
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, updateTournament, isTournamentLocked } from '../../lib/adminData'

export default function EditTournament() {
  const { tournamentId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [pin, setPin] = useState('')
  const [rules, setRules] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getTournament(tournamentId).then((t) => {
      setTournament(t)
      setName(t.name)
      setStartDate(t.startDate ?? '')
      setPin(t.pin ?? '')
      setRules(t.rules)
      // No PIN set on the tournament yet -- nothing to gate, go straight in
      if (!t.pin) setUnlocked(true)
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
    await updateTournament(tournamentId, {
      name: name.trim(),
      startDate: startDate || null,
      pin: pin.trim() || null,
      rules,
    })
    setSaving(false)
    navigate(`/basketball/${tournamentId}`)
  }

  if (!tournament) {
    return <div className="max-w-lg mx-auto px-4 py-10 text-slate-500">Loading...</div>
  }

  const locked = isTournamentLocked(tournament)

  if (locked) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <Link to={`/basketball/${tournamentId}`} className="text-sm text-slate-400 hover:text-slate-600">
          ← Back
        </Link>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-700 font-medium mb-1">This tournament has started</p>
          <p className="text-slate-500 text-sm">
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
        <Link to={`/basketball/${tournamentId}`} className="text-sm text-slate-400 hover:text-slate-600">
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-1 mb-4">Enter PIN to edit</h1>
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {pinError && <p className="text-xs text-red-500">{pinError}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 transition"
          >
            Unlock
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link to={`/basketball/${tournamentId}`} className="text-sm text-slate-400 hover:text-slate-600">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-1 mb-6">Edit Tournament</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tournament name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Edit PIN <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Leave blank for none"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {rules && (
          <div className="grid grid-cols-2 gap-4">
            <RuleInput label="Quarter length (min)" value={rules.quarterMinutes} onChange={(v) => updateRule('quarterMinutes', v)} />
            <RuleInput label="Foul limit (foul-out)" value={rules.foulLimit} onChange={(v) => updateRule('foulLimit', v)} />
            <RuleInput label="Overtime length (min)" value={rules.otMinutes} onChange={(v) => updateRule('otMinutes', v)} />
            <RuleInput label="Timeouts per team" value={rules.timeoutsPerTeam} onChange={(v) => updateRule('timeoutsPerTeam', v)} />
            <RuleInput label="Max roster size" value={rules.maxRosterSize} onChange={(v) => updateRule('maxRosterSize', v)} />
            <RuleInput label="Min games for avg stats" value={rules.avgStatMinGames} onChange={(v) => updateRule('avgStatMinGames', v)} />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

function RuleInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  )
}

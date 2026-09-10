import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTournament, getTeamsForTournament } from '../../lib/adminData'
import { generateManualEliminationBracket } from '../../lib/matchesData'

function nextPowerOfTwoAtLeast(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

export default function ManualBracketBuilder() {
  const { tournamentId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [teams, setTeams] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [selectedTeamIds, setSelectedTeamIds] = useState([])
  const [step, setStep] = useState('select') // 'select' | 'place'

  const [playInSlots, setPlayInSlots] = useState([null, null])
  const [byeSlots, setByeSlots] = useState([])
  const [pairSlots, setPairSlots] = useState([]) // array of [id|null, id|null]

  const [activeTeamId, setActiveTeamId] = useState(null)

  useEffect(() => {
    Promise.all([getTournament(tournamentId), getTeamsForTournament(tournamentId)])
      .then(([t, teamList]) => {
        setTournament(t)
        setTeams(teamList)
      })
      .catch((err) => {
        console.error('Failed to load bracket builder:', err)
        setError('Could not load this tournament. Check your connection and try refreshing.')
      })
  }, [tournamentId])

  function toggleTeamSelection(id) {
    setSelectedTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function proceedToPlacement() {
    const total = selectedTeamIds.length
    if (total < 2) return

    const playInNeeded = total % 2 !== 0
    const remainingAfterPlayIn = playInNeeded ? total - 2 : total
    const bracketSize = nextPowerOfTwoAtLeast(remainingAfterPlayIn + (playInNeeded ? 1 : 0))
    const byeCount = bracketSize - remainingAfterPlayIn - (playInNeeded ? 1 : 0)
    const pairsCount = (remainingAfterPlayIn - byeCount) / 2

    setPlayInSlots(playInNeeded ? [null, null] : [])
    setByeSlots(Array(byeCount).fill(null))
    setPairSlots(Array(pairsCount).fill(null).map(() => [null, null]))
    setActiveTeamId(null)
    setStep('place')
  }

  const placedIds = [...playInSlots, ...byeSlots, ...pairSlots.flat()].filter(Boolean)
  const pool = selectedTeamIds.filter((id) => !placedIds.includes(id))
  const allPlaced = pool.length === 0

  function teamName(id) {
    return teams.find((t) => t.id === id)?.name ?? 'Unknown'
  }

  function placeInSlot(setSlots, index, subIndex = null) {
    if (!activeTeamId) return
    setSlots((prev) => {
      const next = [...prev]
      if (subIndex === null) {
        next[index] = activeTeamId
      } else {
        next[index] = [...next[index]]
        next[index][subIndex] = activeTeamId
      }
      return next
    })
    setActiveTeamId(null)
  }

  function clearSlot(setSlots, index, subIndex = null) {
    setSlots((prev) => {
      const next = [...prev]
      if (subIndex === null) {
        next[index] = null
      } else {
        next[index] = [...next[index]]
        next[index][subIndex] = null
      }
      return next
    })
  }

  async function handleGenerate() {
    setSaving(true)
    setError('')
    try {
      await generateManualEliminationBracket(tournamentId, {
        byeTeamIds: byeSlots,
        pairs: pairSlots,
        playInPair: playInSlots.length ? playInSlots : null,
      })
      navigate(`/basketball/${tournamentId}/schedule`)
    } catch (err) {
      console.error('Failed to generate manual bracket:', err)
      setError(`Could not save the bracket: ${err.message ?? 'unknown error'}`)
      setSaving(false)
    }
  }

  if (!tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-ink-dim">
        {error ? <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div> : 'Loading...'}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/basketball/${tournamentId}/schedule`} className="text-sm text-ink-faint hover:text-ink-dim">
        ← Back to schedule
      </Link>
      <h1 className="text-2xl font-display font-bold tracking-wide text-ink mt-1 mb-1">Build Bracket Manually</h1>
      <p className="text-ink-dim text-sm mb-6">
        {step === 'select' ? 'Pick which teams are in the bracket.' : 'Tap a team below, then tap where they go.'}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
      )}

      {step === 'select' && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {teams.map((t) => {
              const selected = selectedTeamIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeamSelection(t.id)}
                  className={`rounded-lg border px-3 py-2.5 text-sm text-left transition ${
                    selected ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong text-ink-dim hover:bg-panel-alt'
                  }`}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
          <button
            onClick={proceedToPlacement}
            disabled={selectedTeamIds.length < 2}
            className="w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 transition disabled:opacity-40"
          >
            {selectedTeamIds.length < 2 ? 'Select at least 2 teams' : `Continue with ${selectedTeamIds.length} teams`}
          </button>
        </>
      )}

      {step === 'place' && (
        <>
          <div className="rounded-xl border border-line bg-panel p-3 mb-4">
            <p className="text-xs font-semibold text-ink-faint uppercase mb-2">
              {allPlaced ? 'All teams placed' : 'Tap a team to place'}
            </p>
            {pool.length === 0 ? (
              <p className="text-xs text-ink-faint">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {pool.map((id) => (
                  <button
                    key={id}
                    onClick={() => setActiveTeamId(activeTeamId === id ? null : id)}
                    className={`text-xs font-medium rounded-full px-3 py-1.5 transition ${
                      activeTeamId === id ? 'bg-accent text-on-accent' : 'bg-panel-alt border border-line-strong text-ink-dim hover:border-accent'
                    }`}
                  >
                    {teamName(id)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {playInSlots.length > 0 && (
            <div className="rounded-xl border border-line bg-panel p-3 mb-3">
              <p className="text-xs font-semibold text-ink-faint uppercase mb-2">Play-in game</p>
              <div className="flex items-center gap-2">
                {[0, 1].map((i) => (
                  <SlotBox
                    key={i}
                    label={playInSlots[i] ? teamName(playInSlots[i]) : 'Tap to place'}
                    filled={!!playInSlots[i]}
                    onClick={() =>
                      playInSlots[i] ? clearSlot(setPlayInSlots, i) : placeInSlot(setPlayInSlots, i)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {byeSlots.length > 0 && (
            <div className="rounded-xl border border-line bg-panel p-3 mb-3">
              <p className="text-xs font-semibold text-ink-faint uppercase mb-2">Byes (auto-advance to round 2)</p>
              <div className="flex flex-wrap gap-2">
                {byeSlots.map((id, i) => (
                  <SlotBox
                    key={i}
                    label={id ? teamName(id) : 'Tap to place'}
                    filled={!!id}
                    onClick={() => (id ? clearSlot(setByeSlots, i) : placeInSlot(setByeSlots, i))}
                  />
                ))}
              </div>
            </div>
          )}

          {pairSlots.length > 0 && (
            <div className="rounded-xl border border-line bg-panel p-3 mb-4">
              <p className="text-xs font-semibold text-ink-faint uppercase mb-2">Round 1 matchups</p>
              <div className="space-y-2">
                {pairSlots.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <SlotBox
                      label={pair[0] ? teamName(pair[0]) : 'Tap to place'}
                      filled={!!pair[0]}
                      onClick={() => (pair[0] ? clearSlot(setPairSlots, i, 0) : placeInSlot(setPairSlots, i, 0))}
                    />
                    <span className="text-ink-faint text-xs">vs</span>
                    <SlotBox
                      label={pair[1] ? teamName(pair[1]) : 'Tap to place'}
                      filled={!!pair[1]}
                      onClick={() => (pair[1] ? clearSlot(setPairSlots, i, 1) : placeInSlot(setPairSlots, i, 1))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep('select')}
              className="rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt font-medium px-4 py-2.5 transition"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={!allPlaced || saving}
              className="flex-1 rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 transition disabled:opacity-40"
            >
              {saving ? 'Saving...' : allPlaced ? 'Save Bracket' : `${pool.length} team(s) left to place`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SlotBox({ label, filled, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[100px] text-sm rounded-lg border px-3 py-2 text-left transition ${
        filled
          ? 'border-accent bg-accent-soft text-ink'
          : 'border-dashed border-line-strong text-ink-faint hover:border-accent'
      }`}
    >
      {label}
    </button>
  )
}

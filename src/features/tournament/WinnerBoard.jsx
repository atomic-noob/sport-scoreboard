/**
 * Shown to the scorer when a match ends (badminton, pickleball, tennis, and any
 * other game-based sport). Same look as the homepage hero: the dark green
 * gradient with a giant outlined word behind everything. The MVP is shown as an
 * outlined man (a stand-in until players have photos) with their name, the
 * tournament title and the score underneath. The scorer picks the MVP from the
 * players who played; the pick saves right away and can be changed or cleared.
 */
const WORDS = { basketball: 'Hoops', volleyball: 'Spikes', badminton: 'Smash', pickleball: 'Dink', tennis: 'Ace' }
const outline = { WebkitTextStroke: '1.5px rgba(52,211,153,0.35)', color: 'transparent' }

function ManOutline({ className = '' }) {
  // Head and shoulders, drawn as lines only so it matches the outlined hero word.
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="50" cy="34" r="15" />
      <path d="M20 88 C20 66 32 58 50 58 C68 58 80 66 80 88" />
      <path d="M42 58 L50 68 L58 58" opacity=".6" />
    </svg>
  )
}

export default function WinnerBoard({
  sport,
  sportLabel,
  unit = 'Game',
  tournamentName,
  winnerName,
  winnerSide,
  nameA,
  nameB,
  gamesA,
  gamesB,
  history,
  playersA,
  playersB,
  mvpId,
  onPickMvp,
  savingMvp,
  error,
  onDone,
}) {
  const mvp = [...playersA, ...playersB].find((p) => p.id === mvpId) ?? null
  const mvpTeam = mvp ? (playersA.some((p) => p.id === mvp.id) ? nameA : nameB) : null

  function Group({ title, players }) {
    if (!players.length) return null
    return (
      <div className="mb-3 last:mb-0">
        <p className="text-xs text-ink-faint mb-1.5">{title}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {players.map((p) => {
            const on = p.id === mvpId
            return (
              <button
                key={p.id}
                type="button"
                disabled={savingMvp}
                onClick={() => onPickMvp(on ? null : p.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                  on
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line-strong text-ink hover:border-accent hover:text-accent'
                }`}
                aria-pressed={on}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden min-h-[calc(100vh-4rem)]"
      style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
    >
      <div
        className="pointer-events-none select-none absolute inset-x-0 top-4 text-center font-display font-bold leading-none text-[30vw] sm:text-[16rem] opacity-80"
        style={outline}
        aria-hidden="true"
      >
        {WORDS[sport] ?? sportLabel}
      </div>

      <div className="relative max-w-xl mx-auto px-4 sm:px-6 py-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">{sportLabel} &middot; Match complete</p>

        {/* MVP */}
        <div className="mt-8 flex flex-col items-center">
          <div
            className={`relative h-40 w-40 sm:h-48 sm:w-48 rounded-full border-2 flex items-center justify-center ${
              mvp ? 'border-accent text-accent' : 'border-accent/40 text-accent/50'
            }`}
            style={{ boxShadow: mvp ? '0 0 40px rgba(52,211,153,0.25)' : 'none' }}
          >
            <ManOutline className="h-28 w-28 sm:h-32 sm:w-32" />
            <span className="absolute -bottom-3 rounded-full bg-accent px-3 py-0.5 text-xs font-bold tracking-widest text-on-accent">MVP</span>
          </div>
          <h1 className="mt-7 text-3xl sm:text-4xl font-display font-bold tracking-wide text-ink">
            {mvp ? mvp.name : <span className="text-ink-faint">Choose the MVP</span>}
          </h1>
          {mvpTeam && <p className="text-sm text-ink-dim mt-1">{mvpTeam}</p>}
          {tournamentName && <p className="mt-3 text-sm font-medium uppercase tracking-wider text-accent">{tournamentName}</p>}
        </div>

        {/* Score */}
        <div className="mt-6 rounded-2xl border border-line bg-panel/70 backdrop-blur px-5 py-5">
          <p className="text-xs text-ink-faint uppercase tracking-wider mb-1">Winner</p>
          <p className="text-xl font-display font-bold text-ink">{winnerName}</p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-3">
            <p className={`text-right text-sm font-medium truncate ${winnerSide === 'A' ? 'text-ink' : 'text-ink-dim'}`}>{nameA}</p>
            <p className="text-4xl font-display font-bold text-ink tabular-nums">
              {gamesA}<span className="text-ink-faint mx-2">-</span>{gamesB}
            </p>
            <p className={`text-left text-sm font-medium truncate ${winnerSide === 'B' ? 'text-ink' : 'text-ink-dim'}`}>{nameB}</p>
          </div>
          {history.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {history.map((g) => (
                <span key={g.gameNumber} className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-dim tabular-nums">
                  <span className="text-ink-faint mr-1.5">{unit} {g.gameNumber}</span>
                  <span className={g.winner === 'A' ? 'font-bold text-ink' : ''}>{g.scoreA}</span>
                  <span className="mx-1 text-ink-faint">-</span>
                  <span className={g.winner === 'B' ? 'font-bold text-ink' : ''}>{g.scoreB}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pick */}
        <div className="mt-4 rounded-2xl border border-line bg-panel/70 backdrop-blur px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-semibold text-ink">{mvp ? 'Change the MVP' : 'Who was the MVP?'}</p>
            <p className="text-xs text-ink-faint">{mvp ? 'Tap again to clear' : 'Optional'}</p>
          </div>
          <Group title={nameA} players={playersA} />
          <Group title={nameB} players={playersB} />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        )}
        <button
          onClick={onDone}
          className="mt-6 w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition"
        >
          Back to schedule
        </button>
      </div>
    </div>
  )
}

/**
 * Shown to the scorer when a match ends (badminton, pickleball, and any other
 * game-based sport). Shows the winner, the game-by-game result and lets the
 * scorer pick an MVP from the players who played. The pick saves as soon as it
 * is made and can be changed or cleared until the scorer leaves the page.
 */
export default function WinnerBoard({
  sportLabel,
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

  function Group({ title, players, side }) {
    if (!players.length) return null
    return (
      <div className="mb-3 last:mb-0">
        <p className="text-xs text-ink-faint mb-1.5">{title}</p>
        <div className="flex flex-wrap gap-2">
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
                data-side={side}
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
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-2xl border border-line bg-panel overflow-hidden">
        <div className="px-5 pt-6 pb-5 text-center bg-gradient-to-b from-accent/10 to-transparent">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-2">
            {sportLabel} &middot; Final
          </p>
          <h1 className="text-3xl font-display font-bold tracking-wide text-ink leading-tight">{winnerName}</h1>
          <p className="text-sm text-ink-dim mt-1">wins the match</p>
        </div>

        <div className="px-5 pb-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4 border-y border-line">
            <p className={`text-right text-sm font-medium truncate ${winnerSide === 'A' ? 'text-ink' : 'text-ink-dim'}`}>{nameA}</p>
            <p className="text-4xl font-display font-bold text-ink tabular-nums">
              {gamesA}<span className="text-ink-faint mx-2">-</span>{gamesB}
            </p>
            <p className={`text-left text-sm font-medium truncate ${winnerSide === 'B' ? 'text-ink' : 'text-ink-dim'}`}>{nameB}</p>
          </div>

          {history.length > 0 && (
            <table className="w-full text-sm mt-4">
              <thead>
                <tr className="text-xs text-ink-faint">
                  <th className="text-left font-medium pb-1">Game</th>
                  <th className="text-right font-medium pb-1 w-16">{nameA.split(' / ')[0]}</th>
                  <th className="text-right font-medium pb-1 w-16">{nameB.split(' / ')[0]}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => (
                  <tr key={g.gameNumber} className="border-t border-line">
                    <td className="py-1.5 text-ink-dim">Game {g.gameNumber}</td>
                    <td className={`py-1.5 text-right tabular-nums ${g.winner === 'A' ? 'font-bold text-ink' : 'text-ink-dim'}`}>{g.scoreA}</td>
                    <td className={`py-1.5 text-right tabular-nums ${g.winner === 'B' ? 'font-bold text-ink' : 'text-ink-dim'}`}>{g.scoreB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-5 rounded-xl border border-line bg-page p-4">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm font-semibold text-ink">MVP of the match</p>
              <p className="text-xs text-ink-faint">{mvp ? 'Tap again to clear' : 'Optional'}</p>
            </div>
            <Group title={nameA} players={playersA} side="A" />
            <Group title={nameB} players={playersB} side="B" />
            {mvp && <p className="text-xs text-accent mt-3">Saved: {mvp.name} is shown on the match page.</p>}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
          )}
          <button
            onClick={onDone}
            className="mt-5 w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition"
          >
            Back to schedule
          </button>
        </div>
      </div>
    </div>
  )
}

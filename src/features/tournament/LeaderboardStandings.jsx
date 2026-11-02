import { KindIcon } from './WinnerBoard'

/**
 * Live standings for tournaments whose entries are players or fixed pairs.
 * Shown as a leaderboard: rank, an outlined player icon, the name, the record
 * and a win-rate bar. The top three get a stronger green outline. Team
 * tournaments keep the regular table.
 */
export default function LeaderboardStandings({ standings, kind, labels }) {
  return (
    <ol className="space-y-2">
      {standings.map((s, i) => {
        const rank = i + 1
        const top = rank <= 3
        const played = s.wins + s.losses
        const diff = s.pointsFor - s.pointsAgainst
        return (
          <li
            key={s.team.id}
            className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${
              rank === 1
                ? 'border-accent bg-accent-soft'
                : top
                  ? 'border-accent/40 bg-panel'
                  : 'border-line bg-panel'
            }`}
            style={rank === 1 ? { boxShadow: '0 0 28px rgba(52,211,153,0.15)' } : undefined}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-8 shrink-0 text-center font-display text-2xl font-bold ${top ? 'text-accent' : 'text-ink-faint'}`}
              >
                {rank}
              </span>
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${
                  top ? 'border-accent text-accent' : 'border-line-strong text-ink-faint'
                }`}
              >
                <KindIcon kind={kind} className="h-8 w-8" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{s.team.name}</p>
                <p className="text-xs text-ink-dim tabular-nums">
                  {s.wins}W &middot; {s.losses}L
                  {played > 0 && (
                    <span className="ml-2 text-ink-faint">
                      {labels.for} {s.pointsFor} &middot; {labels.against} {s.pointsAgainst}
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-2xl font-bold text-ink tabular-nums">{(s.winPct * 100).toFixed(0)}%</p>
                <p className={`text-xs tabular-nums ${diff > 0 ? 'text-accent' : 'text-ink-faint'}`}>
                  {diff > 0 ? '+' : ''}{diff}
                </p>
              </div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(s.winPct * 100)}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

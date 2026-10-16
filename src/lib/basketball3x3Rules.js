/**
 * FIBA 3x3 basics, kept free of React.
 * - 3 players a side on court plus substitutes (roster of up to 4).
 * - 10 minutes, or the first team to `target` (21). Baskets inside the arc are
 *   1 point, beyond the arc 2 points, free throws 1 point.
 * - 12-second shot clock.
 * - Team fouls: 1-6 normal, 7-9 two free throws on any foul, 10+ two free throws
 *   and the ball.
 * - Tied when time runs out: overtime, first team to score 2 points wins.
 */
export const SHOT_CLOCK_MS = 12000

/** What the team fouls mean for the team that was fouled. */
export function foulPenalty(teamFouls) {
  if (teamFouls >= 10) return { label: '2 free throws + ball', level: 'ball' }
  if (teamFouls >= 7) return { label: 'Bonus: 2 free throws', level: 'bonus' }
  return null
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatShot(ms) {
  return String(Math.max(0, Math.ceil(ms / 1000)))
}

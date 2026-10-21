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

/** Points a kind of basket is worth: inside the arc 1, beyond the arc 2, a free throw 1. */
export const POINTS = { one: 1, two: 2, ft: 1 }

/** Overtime is decided by the first team to score this many points. */
export const OT_TARGET = 2

/**
 * Where the game stands.
 * - A team that reaches `target` ends the game at once (regulation only).
 * - When the clock reaches zero the higher score wins; a tie goes to overtime.
 * - In overtime the first team to score OT_TARGET points wins (no clock).
 */
export function gameStatus({ scoreA, scoreB, target = 21, clockLeftMs, inOT = false, otStartA = 0, otStartB = 0 }) {
  const hitTarget = !inOT && (scoreA >= target || scoreB >= target)
  const otDone = inOT && (scoreA - otStartA >= OT_TARGET || scoreB - otStartB >= OT_TARGET)
  const timeUp = !inOT && !hitTarget && clockLeftMs <= 0
  const needsOT = timeUp && scoreA === scoreB
  const ended = hitTarget || otDone || (timeUp && scoreA !== scoreB)
  return { hitTarget, otDone, timeUp, needsOT, ended, winner: ended ? (scoreA > scoreB ? 'A' : 'B') : null }
}

/** Suggests the MVP: most points, then fewest fouls. Returns a player id or null. */
export function suggestMvp(stats, playerIds) {
  let best = null
  for (const id of playerIds) {
    const s = stats[id]
    if (!s || (s.points ?? 0) <= 0) continue
    if (!best || s.points > best.points || (s.points === best.points && (s.fouls ?? 0) < best.fouls)) {
      best = { id, points: s.points, fouls: s.fouls ?? 0 }
    }
  }
  return best ? best.id : null
}

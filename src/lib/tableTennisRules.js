/**
 * Pure table tennis rules (ITTF Laws of Table Tennis), kept free of React so
 * they are easy to test.
 *
 * - A game is won at 11 points with a lead of 2 (so 10-10 plays on until
 *   someone is two ahead).
 * - Service changes every 2 points. From 10-10 (deuce) it changes every point.
 * - Doubles: the serving order is first server -> first receiver -> the first
 *   server's partner -> the first receiver's partner, and then it repeats.
 *   Each player serves to the opponent who served to them last.
 * - In the next game the other side serves first; in doubles its first server
 *   is chosen, and the first receiver is the opponent who served to that player
 *   in the previous game.
 * - Players change ends after every game, and in the deciding game when the
 *   first side reaches 5 points.
 */

export const DEFAULT_TARGET = 11

export function isGameOver(scoreA, scoreB, target = DEFAULT_TARGET) {
  const t = Number(target)
  const hi = Math.max(scoreA, scoreB)
  const lo = Math.min(scoreA, scoreB)
  return hi >= t && hi - lo >= 2
}

/** True when one more point wins the game for that side. */
export function gamePointFor(scoreA, scoreB, target = DEFAULT_TARGET) {
  const check = (me, other) => isGameOver(me + 1, other, target) && !isGameOver(me, other, target)
  return { A: check(scoreA, scoreB), B: check(scoreB, scoreA) }
}

/**
 * The serving order for a game: an array of { side, idx } that repeats.
 * Singles: [first server, receiver]. Doubles: [first server, first receiver,
 * first server's partner, first receiver's partner].
 */
export function makeOrder(firstSide, firstIdx, receiverIdx, perSide) {
  const other = firstSide === 'A' ? 'B' : 'A'
  if (perSide < 2) return [{ side: firstSide, idx: 0 }, { side: other, idx: 0 }]
  return [
    { side: firstSide, idx: firstIdx },
    { side: other, idx: receiverIdx },
    { side: firstSide, idx: 1 - firstIdx },
    { side: other, idx: 1 - receiverIdx },
  ]
}

/** Fresh state for the start of a game. */
export function newGameState(order) {
  return { scoreA: 0, scoreB: 0, order }
}

/** Returns the state after `side` ('A' | 'B') wins the rally. */
export function applyPoint(state, side) {
  return side === 'A' ? { ...state, scoreA: state.scoreA + 1 } : { ...state, scoreB: state.scoreB + 1 }
}

/** Which serving slot we are in: 2 points each, then 1 point each from 10-10. */
function slotOf(state) {
  const total = state.scoreA + state.scoreB
  return total < 20 ? Math.floor(total / 2) : total - 10
}

/** Who serves and who receives the next point: { server: {side, idx}, receiver: {side, idx} }. */
export function whoIsWho(state) {
  const n = state.order.length
  const k = slotOf(state) % n
  return { server: state.order[k], receiver: state.order[(k + 1) % n] }
}

/** True once a side reached the point where the serve changes (to show a "serve changes" hint). */
export function serveJustChanged(prev, next) {
  return slotOf(prev) !== slotOf(next)
}

/**
 * Doubles, game 2 onwards: the first receiver is the opponent who served to the
 * chosen first server in the previous game.
 */
export function receiverFor(prevOrder, firstSide, firstIdx) {
  const n = prevOrder.length
  const pos = prevOrder.findIndex((o) => o.side === firstSide && o.idx === firstIdx)
  return prevOrder[(pos - 1 + n) % n].idx
}

/** Deciding game: ends change when the first side reaches 5 (once). */
export function reachedChangeEnds(prev, next) {
  const before = Math.max(prev.scoreA, prev.scoreB)
  const after = Math.max(next.scoreA, next.scoreB)
  return before < 5 && after >= 5
}

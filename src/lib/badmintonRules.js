/**
 * Pure badminton rules (BWF Laws of Badminton, rally point scoring), kept free of
 * React so they are easy to test.
 *
 * - Every rally scores a point for the side that wins it.
 * - A game is won at `target` points with a lead of 2; at (target + 8)-all the
 *   next point wins, so the game never goes past target + 9 (21 -> 30).
 * - The server stands in the RIGHT service court when their side's score is even
 *   and in the LEFT court when it is odd (singles and doubles).
 * - Doubles: the side that wins a rally while serving swaps its two players'
 *   courts; the side that wins a rally while receiving takes over serve and
 *   does not swap.
 */

export function gameCap(target) {
  return Number(target) + 9
}

export function isGameOver(scoreA, scoreB, target) {
  const t = Number(target)
  const hi = Math.max(scoreA, scoreB)
  const lo = Math.min(scoreA, scoreB)
  return hi >= gameCap(t) || (hi >= t && hi - lo >= 2)
}

/** True when a score is at game point (one more point wins the game for that side). */
export function gamePointFor(scoreA, scoreB, target) {
  const t = Number(target)
  const check = (me, other) => isGameOver(me + 1, other, t) && !isGameOver(me, other, t)
  return { A: check(scoreA, scoreB), B: check(scoreB, scoreA) }
}

/** Fresh state for the start of a game. `serving` is 'A' or 'B'. */
export function newGameState(serving) {
  // rightA / rightB: index (0 or 1) of the player standing in that side's RIGHT court.
  return { scoreA: 0, scoreB: 0, serving, rightA: 0, rightB: 0 }
}

/** Returns the state after `side` ('A' | 'B') wins the rally. */
export function applyPoint(state, side) {
  const next = { ...state }
  if (side === 'A') next.scoreA += 1
  else next.scoreB += 1
  if (side === state.serving) {
    if (side === 'A') next.rightA = 1 - state.rightA
    else next.rightB = 1 - state.rightB
  } else {
    next.serving = side
  }
  return next
}

/** 'right' when the serving side's score is even, otherwise 'left'. */
export function serviceCourt(state) {
  const servingScore = state.serving === 'A' ? state.scoreA : state.scoreB
  return servingScore % 2 === 0 ? 'right' : 'left'
}

/**
 * Where everyone stands. For each side, `rightIdx` is the player index in the
 * right court; the receiving side's receiver stands in the court with the same
 * name (right/left) as the server's, because the serve goes diagonally.
 * Returns { server: {side, playerIdx, court}, receiver: {side, playerIdx, court} }.
 */
export function whoIsWho(state, playersPerSide) {
  const court = serviceCourt(state)
  const rightIdx = (side) => (side === 'A' ? state.rightA : state.rightB)
  const idxIn = (side, c) => {
    if (playersPerSide < 2) return 0
    const r = rightIdx(side)
    return c === 'right' ? r : 1 - r
  }
  const receiving = state.serving === 'A' ? 'B' : 'A'
  return {
    server: { side: state.serving, playerIdx: idxIn(state.serving, court), court },
    receiver: { side: receiving, playerIdx: idxIn(receiving, court), court },
  }
}

/** The BWF mid-game interval: when the leading side reaches 11 (once per game). */
export function reachedInterval(prev, next, target) {
  const mid = Math.ceil(Number(target) / 2) + (Number(target) === 21 ? 0 : 0)
  const point = Number(target) === 21 ? 11 : Number(target) === 15 ? 8 : mid
  const before = Math.max(prev.scoreA, prev.scoreB)
  const after = Math.max(next.scoreA, next.scoreB)
  return before < point && after >= point
}

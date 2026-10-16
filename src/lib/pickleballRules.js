/**
 * Pure pickleball rules (USA Pickleball, traditional side-out scoring), kept
 * free of React so they are easy to test.
 *
 * - Only the SERVING side can score. If the server wins the rally their side
 *   scores a point; if they lose it is a fault.
 * - A game goes to `target` (11, 15 or 21) and must be won by 2 (no cap).
 * - Singles: the server serves from the RIGHT court when their own score is
 *   even and the LEFT court when it is odd. A lost rally is a side-out.
 * - Doubles: each side has two servers. The very first serving side of a game
 *   only gets ONE server (the score is called "0-0-2"), so one fault is a
 *   side-out. After that, each side-out starts with server 1 in the RIGHT
 *   court; when server 1 faults, server 2 (the partner) serves from where they
 *   stand; when server 2 faults it is a side-out.
 * - Whenever the serving side scores, its two players swap courts and the same
 *   server serves again from the other court. The receiving side never moves.
 */

export function isGameOver(scoreA, scoreB, target) {
  const hi = Math.max(scoreA, scoreB)
  const lo = Math.min(scoreA, scoreB)
  return hi >= Number(target) && hi - lo >= 2
}

/** Only the serving side can be on game point: one more point wins the game for them. */
export function gamePointFor(state, target) {
  if (!state || isGameOver(state.scoreA, state.scoreB, target)) return { A: false, B: false }
  const mine = state.serving === 'A' ? state.scoreA : state.scoreB
  const theirs = state.serving === 'A' ? state.scoreB : state.scoreA
  const wins = isGameOver(mine + 1, theirs, target)
  return { A: state.serving === 'A' && wins, B: state.serving === 'B' && wins }
}

const parityCourt = (score) => (score % 2 === 0 ? 'right' : 'left')

/**
 * Fresh state for the start of a game. `serving` is 'A' or 'B'.
 * rightA / rightB: index (0 or 1) of the player standing in that side's RIGHT court.
 * serverNum: 1 or 2 (doubles). court: where the current server stands.
 */
export function newGameState(serving, perSide) {
  return { scoreA: 0, scoreB: 0, serving, serverNum: perSide === 2 ? 2 : 1, court: 'right', rightA: 0, rightB: 0 }
}

/** The serving side wins the rally: it scores, and (doubles) its players swap courts. */
export function applyServerPoint(state, perSide) {
  const next = { ...state }
  const side = state.serving
  if (side === 'A') next.scoreA += 1
  else next.scoreB += 1
  if (perSide === 2) {
    if (side === 'A') next.rightA = 1 - state.rightA
    else next.rightB = 1 - state.rightB
    next.court = state.court === 'right' ? 'left' : 'right'
  } else {
    next.court = parityCourt(side === 'A' ? next.scoreA : next.scoreB)
  }
  return next
}

/** The serving side loses the rally: next server (doubles) or side-out. */
export function applyFault(state, perSide) {
  const next = { ...state }
  if (perSide === 2 && state.serverNum === 1) {
    next.serverNum = 2
    next.court = state.court === 'right' ? 'left' : 'right' // the partner serves from where they stand
    return next
  }
  // Side-out: the other side serves.
  next.serving = state.serving === 'A' ? 'B' : 'A'
  next.serverNum = 1
  if (perSide === 2) next.court = 'right'
  else next.court = parityCourt(next.serving === 'A' ? next.scoreA : next.scoreB)
  return next
}

/**
 * Where everyone stands. The server is in `court`; the receiver stands in the
 * court with the same name on the other side (the serve goes cross-court).
 * Returns { server: {side, playerIdx, court}, receiver: {side, playerIdx, court} }.
 */
export function whoIsWho(state, perSide) {
  const rightIdx = (side) => (side === 'A' ? state.rightA : state.rightB)
  const idxIn = (side, c) => (perSide < 2 ? 0 : c === 'right' ? rightIdx(side) : 1 - rightIdx(side))
  const receiving = state.serving === 'A' ? 'B' : 'A'
  return {
    server: { side: state.serving, playerIdx: idxIn(state.serving, state.court), court: state.court },
    receiver: { side: receiving, playerIdx: idxIn(receiving, state.court), court: state.court },
  }
}

/** The score as the server calls it: serving score, receiving score, and (doubles) server number. */
export function scoreCall(state, perSide) {
  const mine = state.serving === 'A' ? state.scoreA : state.scoreB
  const theirs = state.serving === 'A' ? state.scoreB : state.scoreA
  return perSide === 2 ? `${mine}-${theirs}-${state.serverNum}` : `${mine}-${theirs}`
}

/** Middle of a game: ends are changed here in a deciding game (6 of 11, 8 of 15, 11 of 21). */
export function midpoint(target) {
  return Math.ceil(Number(target) / 2)
}

export function reachedMidpoint(prev, next, target) {
  const m = midpoint(target)
  return Math.max(prev.scoreA, prev.scoreB) < m && Math.max(next.scoreA, next.scoreB) >= m
}

/**
 * Pure tennis rules (ITF), kept free of React so they are easy to test.
 *
 * A match is best of 1, 3 or 5 sets. A set is won by the first side to
 * `gamesPerSet` games (6 normally) with a lead of two; at `gamesPerSet`-all a
 * tiebreak (first to 7, win by 2) decides the set. A game is 0/15/30/40 with
 * deuce and advantage, or "no-ad" where one deciding point is played at deuce.
 * The deciding set can instead be a single "match tiebreak" to 10.
 *
 * Serving: the serve alternates every game. In a tiebreak the first server
 * serves one point, then each side serves two points in turn. The server
 * serves from the right (deuce) court when the points played in the game are
 * even and from the left (ad) court when odd. Ends are changed after the first
 * game and every second game after that (after an odd total of games), and
 * every 6 points of a tiebreak.
 */

const other = (s) => (s === 'A' ? 'B' : 'A')

export function newMatch(firstServer) {
  return {
    sets: [], // finished sets: { a, b, tb: { a, b } | null }
    winsA: 0,
    winsB: 0,
    gA: 0,
    gB: 0,
    pA: 0,
    pB: 0,
    mode: 'game', // 'game' | 'tiebreak' | 'matchtb'
    serving: firstServer, // who serves the current game / starts the current tiebreak
    served: { A: 0, B: 0 }, // service games each side has played (for doubles partner order)
    swaps: 0, // how many times the teams have changed ends
    over: false,
    winner: null,
  }
}

/** Which set number is being played (1-based). */
export const setNumber = (m) => m.sets.length + 1

/** True when this set is the deciding one. */
export function isDecidingSet(m, setsToWin) {
  return setsToWin > 1 && m.winsA === setsToWin - 1 && m.winsB === setsToWin - 1
}

/** Side that serves the next point. */
export function currentServer(m) {
  if (m.mode === 'game') return m.serving
  const n = m.pA + m.pB
  const t = Math.floor((n + 1) / 2)
  return t % 2 === 0 ? m.serving : other(m.serving)
}

/** Court the server stands in: right (deuce) when points played are even. */
export function serveCourt(m) {
  return (m.pA + m.pB) % 2 === 0 ? 'right' : 'left'
}

/** Index of the serving player within their side (0 or 1 in doubles). */
export function serverIdx(m, perSide) {
  if (perSide < 2) return 0
  if (m.mode === 'game') return m.served[m.serving] % 2
  const n = m.pA + m.pB
  const t = Math.floor((n + 1) / 2)
  const side = t % 2 === 0 ? m.serving : other(m.serving)
  return (m.served[side] + Math.floor(t / 2)) % 2
}

/** Index of the receiving player: they stand cross-court, so it follows the server's court. */
export function receiverIdx(m, perSide, receiverRightIdx = 0) {
  if (perSide < 2) return 0
  return serveCourt(m) === 'right' ? receiverRightIdx : 1 - receiverRightIdx
}

function gameWon(p, q, noAd) {
  if (noAd) return p >= 4
  return p >= 4 && p - q >= 2
}

/** What the scoreboard shows for each side's points in the current game. */
export function pointLabels(m, noAd) {
  if (m.mode !== 'game') return { A: String(m.pA), B: String(m.pB) }
  const seq = ['0', '15', '30', '40']
  const { pA, pB } = m
  if (pA >= 3 && pB >= 3) {
    if (noAd) return { A: '40', B: '40' }
    if (pA === pB) return { A: '40', B: '40' }
    return pA > pB ? { A: 'Ad', B: '40' } : { A: '40', B: 'Ad' }
  }
  return { A: seq[Math.min(pA, 3)], B: seq[Math.min(pB, 3)] }
}

/** Small helper text for the current situation ("Deuce", "Deciding point", ...). */
export function situation(m, noAd) {
  if (m.mode === 'game' && m.pA >= 3 && m.pB >= 3 && m.pA === m.pB) return noAd ? 'Deciding point' : 'Deuce'
  return ''
}

/** Who (if anyone) is one point from winning the current game / tiebreak. */
function pointToWin(m, rules) {
  const noAd = !!rules.noAd
  const out = { A: false, B: false }
  for (const s of ['A', 'B']) {
    const p = s === 'A' ? m.pA : m.pB
    const q = s === 'A' ? m.pB : m.pA
    if (m.mode === 'game') out[s] = gameWon(p + 1, q, noAd)
    else {
      const t = m.mode === 'matchtb' ? 10 : 7
      out[s] = p + 1 >= t && p + 1 - q >= 2
    }
  }
  return out
}

/** Who would win the SET with the next game, and who would win the MATCH. */
export function setAndMatchPoint(m, rules) {
  const ptw = pointToWin(m, rules)
  const N = Number(rules.gamesPerSet ?? 6)
  const setsToWin = Number(rules.setsToWin ?? 2)
  const res = { setPoint: { A: false, B: false }, matchPoint: { A: false, B: false } }
  for (const s of ['A', 'B']) {
    if (!ptw[s]) continue
    const g = s === 'A' ? m.gA : m.gB
    const h = s === 'A' ? m.gB : m.gA
    let winsSet = false
    if (m.mode === 'matchtb') winsSet = true
    else if (m.mode === 'tiebreak') winsSet = true
    else winsSet = g + 1 >= N && g + 1 - h >= 2
    if (winsSet) {
      res.setPoint[s] = true
      const w = s === 'A' ? m.winsA : m.winsB
      if (w + 1 >= setsToWin) res.matchPoint[s] = true
    }
  }
  return res
}

function pushSet(m, a, b, tb) {
  m.sets = [...m.sets, { a, b, tb }]
  if (a > b) m.winsA += 1
  else m.winsB += 1
}

/** Start the next set: reset the games and decide if it is a normal set or a match tiebreak. */
function startNextSet(m, rules) {
  m.gA = 0
  m.gB = 0
  m.pA = 0
  m.pB = 0
  m.mode = isDecidingSet(m, Number(rules.setsToWin ?? 2)) && Number(rules.matchTiebreak) === 1 ? 'matchtb' : 'game'
}

/**
 * One point won by `winner` ('A' or 'B'). Returns the new match state plus
 * `events`: what happened ('game', 'set', 'match', 'changeEnds') so the screen
 * can show a notice and save a finished set.
 */
export function applyPoint(prev, winner, rules) {
  if (prev.over) return { match: prev, events: [] }
  const noAd = !!rules.noAd
  const N = Number(rules.gamesPerSet ?? 6)
  const setsToWin = Number(rules.setsToWin ?? 2)
  const m = { ...prev, served: { ...prev.served }, sets: prev.sets }
  const events = []

  if (winner === 'A') m.pA += 1
  else m.pB += 1

  if (m.mode === 'game') {
    const p = winner === 'A' ? m.pA : m.pB
    const q = winner === 'A' ? m.pB : m.pA
    if (!gameWon(p, q, noAd)) return { match: m, events }

    // The game is over.
    if (winner === 'A') m.gA += 1
    else m.gB += 1
    m.served[m.serving] += 1
    m.pA = 0
    m.pB = 0
    events.push('game')
    const g = winner === 'A' ? m.gA : m.gB
    const h = winner === 'A' ? m.gB : m.gA
    const total = m.gA + m.gB

    if (g >= N && g - h >= 2) {
      pushSet(m, m.gA, m.gB, null)
      events.push('set')
      if (total % 2 === 1) {
        m.swaps += 1
        events.push('changeEnds')
      }
      m.serving = other(m.serving)
      if (m.winsA >= setsToWin || m.winsB >= setsToWin) {
        m.over = true
        m.winner = m.winsA > m.winsB ? 'A' : 'B'
        events.push('match')
      } else {
        startNextSet(m, rules)
      }
      return { match: m, events }
    }

    m.serving = other(m.serving)
    if (m.gA === N && m.gB === N) {
      m.mode = 'tiebreak' // m.serving is now the player who starts the tiebreak
    }
    if (total % 2 === 1) {
      m.swaps += 1
      events.push('changeEnds')
    }
    return { match: m, events }
  }

  // Tiebreak (7) or match tiebreak (10).
  const target = m.mode === 'matchtb' ? 10 : 7
  const p = winner === 'A' ? m.pA : m.pB
  const q = winner === 'A' ? m.pB : m.pA
  const n = m.pA + m.pB
  if (p >= target && p - q >= 2) {
    if (m.mode === 'tiebreak') {
      // A tiebreak decides the set 7-6 (or N+1 to N): the tiebreak counts as one game.
      if (winner === 'A') m.gA += 1
      else m.gB += 1
      m.served[m.serving] += 1
      pushSet(m, m.gA, m.gB, { a: m.pA, b: m.pB })
      events.push('game', 'set')
      if ((m.gA + m.gB) % 2 === 1) {
        m.swaps += 1
        events.push('changeEnds')
      }
    } else {
      // Match tiebreak stands in for the whole deciding set: stored as the tiebreak score.
      pushSet(m, m.pA, m.pB, { a: m.pA, b: m.pB, match: true })
      events.push('set')
    }
    m.pA = 0
    m.pB = 0
    m.serving = other(m.serving)
    if (m.winsA >= setsToWin || m.winsB >= setsToWin) {
      m.over = true
      m.winner = m.winsA > m.winsB ? 'A' : 'B'
      events.push('match')
    } else {
      startNextSet(m, rules)
    }
    return { match: m, events }
  }

  if (n % 6 === 0) {
    m.swaps += 1
    events.push('changeEnds')
  }
  return { match: m, events }
}

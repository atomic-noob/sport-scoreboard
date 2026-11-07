import { completeMatch, saveActionLog } from './matchesData'
import { saveMatchSet } from './volleyballData'
import { clearMatchState } from './liveMatchState'

/**
 * Results that could not be saved because the connection dropped.
 *
 * A finished set or a finished match is written to this queue (kept in the
 * phone's own storage, so it survives a refresh or closing the tab) and sent
 * again automatically when the connection is back. Jobs are sent oldest
 * first, so a match is always completed after its sets.
 *
 * Every job is safe to send twice: sets are upserts, completing a match just
 * updates the same row, and player stats are replaced rather than added.
 */

const KEY = 'sylve-save-queue'
const EVENT = 'sylve-save-queue-changed'
let flushing = false

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage full or blocked: the job simply is not kept across a refresh
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Put (or replace) a job. Same key = same thing, so the newest copy wins. */
function enqueue(job) {
  const list = read().filter((j) => j.key !== job.key)
  list.push({ ...job, createdAt: Date.now(), attempts: 0 })
  write(list)
}

export function pendingSaveCount() {
  return read().length
}

export function pendingSavesForMatch(matchId) {
  return read().filter((j) => j.matchId === matchId).length
}

export function subscribeSaveQueue(fn) {
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

async function run(job) {
  if (job.kind === 'set') {
    const [matchId, setNumber, a, b, winnerTeamId] = job.args
    await saveMatchSet(matchId, setNumber, a, b, winnerTeamId)
  } else if (job.kind === 'complete') {
    const [matchId, a, b, options] = job.args
    await completeMatch(matchId, a, b, options ?? {})
    await clearMatchState(matchId) // spectators now read the saved result
  } else if (job.kind === 'actionLog') {
    const [matchId, log] = job.args
    await saveActionLog(matchId, log)
  }
}

/** Send everything waiting. Stops at the first failure so order is kept. */
export async function flushSaveQueue() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    const list = read().sort((x, y) => x.createdAt - y.createdAt)
    for (const job of list) {
      try {
        await run(job)
        write(read().filter((j) => j.key !== job.key || j.createdAt !== job.createdAt))
      } catch (err) {
        console.warn('Saved result still waiting, will retry:', err?.message ?? err)
        write(read().map((j) => (j.key === job.key ? { ...j, attempts: (j.attempts ?? 0) + 1 } : j)))
        break
      }
    }
  } finally {
    flushing = false
  }
}

/**
 * Save a finished set/game. Returns { queued: true } when it could not be
 * sent right now; it will be sent automatically later.
 */
export async function saveSetSafe(matchId, setNumber, a, b, winnerTeamId) {
  const job = { key: `set:${matchId}:${setNumber}`, kind: 'set', matchId, args: [matchId, setNumber, a, b, winnerTeamId] }
  // Something for this match is already waiting: join the line so order is kept.
  if (pendingSavesForMatch(matchId) > 0 || !navigator.onLine) {
    enqueue(job)
    flushSaveQueue()
    return { queued: true }
  }
  try {
    await saveMatchSet(matchId, setNumber, a, b, winnerTeamId)
    return { queued: false }
  } catch (err) {
    console.warn('Could not save set result, queued for retry:', err?.message ?? err)
    enqueue(job)
    return { queued: true }
  }
}

/** Save the final result of a match, with the same "queued" answer. */
export async function completeMatchSafe(matchId, a, b, options = {}) {
  const job = { key: `complete:${matchId}`, kind: 'complete', matchId, args: [matchId, a, b, options] }
  if (pendingSavesForMatch(matchId) > 0 || !navigator.onLine) {
    enqueue(job)
    flushSaveQueue()
    return { queued: true }
  }
  try {
    await completeMatch(matchId, a, b, options)
    await clearMatchState(matchId)
    return { queued: false }
  } catch (err) {
    console.warn('Could not save final result, queued for retry:', err?.message ?? err)
    enqueue(job)
    return { queued: true }
  }
}

/** Basketball's action log: queued the same way. */
export async function saveActionLogSafe(matchId, log) {
  const job = { key: `log:${matchId}`, kind: 'actionLog', matchId, args: [matchId, log] }
  if (pendingSavesForMatch(matchId) > 0 || !navigator.onLine) {
    enqueue(job)
    flushSaveQueue()
    return { queued: true }
  }
  try {
    await saveActionLog(matchId, log)
    return { queued: false }
  } catch (err) {
    console.warn('Could not save action log, queued for retry:', err?.message ?? err)
    enqueue(job)
    return { queued: true }
  }
}

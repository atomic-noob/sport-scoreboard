import { supabase } from './supabaseClient'

export const FEEDBACK_KINDS = [
  { value: 'bug', label: 'Something broke' },
  { value: 'idea', label: 'An idea or request' },
  { value: 'praise', label: 'Something I liked' },
  { value: 'other', label: 'Something else' },
]

const COOLDOWN_KEY = 'sylve-feedback-last'
const COOLDOWN_MS = 30 * 1000

/** Sends one piece of feedback. Throws a friendly Error if it cannot be saved. */
export async function sendFeedback({ kind, message, contact }) {
  const text = (message || '').trim()
  if (text.length < 3) throw new Error('Please write a little more.')
  if (text.length > 2000) throw new Error('That is a bit long. Please keep it under 2000 characters.')

  try {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0)
    if (Date.now() - last < COOLDOWN_MS) throw new Error('Thank you. Please wait a few seconds before sending another one.')
  } catch (e) {
    if (e.message.startsWith('Thank you')) throw e
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('You look offline. Please try again when you have a connection.')
  }

  const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: null }))
  const userId = userData?.user?.id ?? null

  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    kind: FEEDBACK_KINDS.some((k) => k.value === kind) ? kind : 'other',
    message: text,
    contact: (contact || '').trim().slice(0, 200) || null,
    page: window.location.pathname.slice(0, 300),
    user_agent: navigator.userAgent.slice(0, 300),
  })
  if (error) throw new Error('We could not send that. Please try again in a moment.')

  try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())) } catch { /* private mode */ }
}

/** True when the signed-in user is listed in feedback_admins (so they may read the inbox). */
export async function isFeedbackAdmin() {
  const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: null }))
  const id = userData?.user?.id
  if (!id) return false
  const { data, error } = await supabase.from('feedback_admins').select('user_id').eq('user_id', id).maybeSingle()
  return !error && !!data
}

export async function listFeedback() {
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) throw new Error('Could not load feedback.')
  return data || []
}

export async function setFeedbackStatus(id, status) {
  const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
  if (error) throw new Error('Could not update that item.')
}

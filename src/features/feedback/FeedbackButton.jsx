import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageSquarePlus, X } from 'lucide-react'
import { FEEDBACK_KINDS, sendFeedback } from '../../lib/feedbackData'

/**
 * A small "Feedback" button fixed to the bottom corner of every page, which opens a short form.
 * Hidden on the live scoring screens so it never gets in the scorer's way.
 */
export default function FeedbackButton() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('idea')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [trap, setTrap] = useState('') // honest people never fill this in
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const areaRef = useRef(null)

  useEffect(() => { if (open && !sent) areaRef.current?.focus() }, [open, sent])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const onScoringScreen = /^\/[^/]+\/[^/]+\/match\//.test(pathname)
  if (onScoringScreen) return null

  function close() {
    setOpen(false)
    if (sent) { setSent(false); setMessage(''); setContact(''); setKind('idea') }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (trap) { setSent(true); return } // pretend success to bots
    setBusy(true)
    try {
      await sendFeedback({ kind, message, contact })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-[#0c140c]/95 px-4 py-2.5 text-sm font-semibold text-emerald-300 shadow-lg shadow-black/40 backdrop-blur hover:bg-emerald-400/10 transition"
      >
        <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
          <div className="absolute inset-0 bg-black/70" onClick={close} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-line-strong bg-panel p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <button type="button" onClick={close} className="absolute top-3 right-3 p-2 rounded-lg text-ink-dim hover:text-ink hover:bg-panel-alt" aria-label="Close">
              <X className="w-4 h-4" />
            </button>

            {sent ? (
              <div className="py-6 text-center">
                <h2 id="feedback-title" className="text-xl font-bold text-ink">Thank you</h2>
                <p className="mt-2 text-sm text-ink-dim">Your feedback was sent. It helps us decide what to build next.</p>
                <button type="button" onClick={close} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-strong">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <h2 id="feedback-title" className="text-xl font-bold text-ink">Send feedback</h2>
                  <p className="mt-1 text-sm text-ink-dim">Tell us what worked, what did not, and what you wish Sylve had.</p>
                </div>

                <fieldset>
                  <legend className="sr-only">What kind of feedback</legend>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_KINDS.map((k) => (
                      <label key={k.value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${kind === k.value ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-dim hover:text-ink'}`}>
                        <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
                        {k.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="fb-message" className="block text-sm font-medium text-ink mb-1">Your message</label>
                  <textarea
                    id="fb-message"
                    ref={areaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    required
                    className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                    placeholder="What happened, or what would you like to see?"
                  />
                </div>

                <div>
                  <label htmlFor="fb-contact" className="block text-sm font-medium text-ink mb-1">Email or Facebook name <span className="text-ink-faint font-normal">(optional)</span></label>
                  <input
                    id="fb-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                    placeholder="So we can reply if we have a question"
                  />
                </div>

                {/* Spam trap: hidden from people, bots fill it in. */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
                </div>

                {error && <p role="alert" className="text-sm text-live">{error}</p>}

                <p className="text-xs text-ink-faint">We save the page you were on and your device type to help us fix problems. See our Privacy page.</p>

                <button type="submit" disabled={busy} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60">
                  {busy ? 'Sending...' : 'Send feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

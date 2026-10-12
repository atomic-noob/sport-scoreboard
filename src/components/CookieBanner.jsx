import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getCookieConsent, setCookieConsent, OPEN_COOKIE_SETTINGS } from '../lib/cookieConsent'

export default function CookieBanner() {
  const location = useLocation()
  const [open, setOpen] = useState(() => getCookieConsent() === null)

  // Footer "Cookie settings" links reopen the banner.
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS, show)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, show)
  }, [])

  // Never cover the live scoring screen.
  if (!open || location.pathname.includes('/match/')) return null

  function choose(value) {
    setCookieConsent(value)
    setOpen(false)
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-md z-50">
      <div className="rounded-2xl border border-white/10 bg-black/85 backdrop-blur p-4 text-white shadow-2xl">
        <p className="text-sm font-medium mb-1">🍪 Cookies &amp; local storage</p>
        <p className="text-xs text-white/60 mb-3">
          We use essential storage to keep you signed in, remember your cookie choice and save a match in progress.
          No ads, no tracking. Read our{' '}
          <Link to="/privacy#cookies" className="text-emerald-400 hover:text-emerald-300 underline">Privacy &amp; Cookies</Link>{' '}
          and{' '}
          <Link to="/terms" className="text-emerald-400 hover:text-emerald-300 underline">Terms</Link>.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => choose('accepted')}
            className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium py-2 transition"
          >
            Accept
          </button>
          <button
            onClick={() => choose('essential')}
            className="flex-1 rounded-lg border border-white/20 hover:bg-white/10 text-white/80 text-sm font-medium py-2 transition"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  )
}

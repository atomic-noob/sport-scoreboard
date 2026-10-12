import { Link } from 'react-router-dom'
import { SITE_NAME, LEGAL_UPDATED } from '../lib/legal'
import { OPEN_COOKIE_SETTINGS } from '../lib/cookieConsent'

/** Shared look for the Terms and Privacy pages. */
export default function LegalPage({ title, children }) {
  return (
    <div className="min-h-screen w-full relative overflow-hidden text-white">
      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />
      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-sm text-white/50 hover:text-white/80">← Back home</Link>
          <Link to="/" className="text-lg font-display font-bold tracking-wide text-emerald-400">{SITE_NAME}</Link>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mb-1">{title}</h1>
        <p className="text-xs text-white/40 mb-8">Last updated {LEGAL_UPDATED}</p>
        <div className="space-y-6 text-sm leading-relaxed text-white/75">{children}</div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/40">
          <Link to="/terms" className="hover:text-white/70">Terms</Link>
          <Link to="/privacy" className="hover:text-white/70">Privacy &amp; Cookies</Link>
          <button onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))} className="hover:text-white/70">
            Cookie settings
          </button>
        </div>
      </div>
    </div>
  )
}

export function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-display font-bold tracking-wide text-white mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

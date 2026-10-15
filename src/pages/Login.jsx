import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../lib/auth'

/* ---------- background art (same line-art style as the homepage) ---------- */

function HoopArt({ className = '' }) {
  return (
    <svg viewBox="0 0 240 340" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="10" y="10" width="220" height="150" rx="10" />
      <rect x="80" y="62" width="80" height="62" rx="4" />
      <ellipse cx="120" cy="176" rx="58" ry="12" strokeWidth="5" />
      <path d="M64 180 L88 292 M92 186 L106 296 M120 190 L120 298 M148 186 L134 296 M176 180 L152 292" />
      <path d="M74 224 Q120 242 166 224 M84 262 Q120 276 156 262" />
    </svg>
  )
}

function SpikeArt({ className = '' }) {
  return (
    <svg viewBox="0 0 320 260" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="220" cy="70" r="40" />
      <path d="M190 42 Q236 70 194 102 M250 36 Q226 70 250 106 M182 70 Q220 56 258 70" />
      <path d="M170 24 L96 98 M196 12 L116 92 M144 44 L84 104" strokeDasharray="2 10" />
      <path d="M0 200 H320 M0 232 H320" />
      <path d="M0 200 V232 M32 200 V232 M64 200 V232 M96 200 V232 M128 200 V232 M160 200 V232 M192 200 V232 M224 200 V232 M256 200 V232 M288 200 V232 M320 200 V232" />
      <path d="M0 200 H320" strokeWidth="6" />
    </svg>
  )
}

const PERKS = [
  ['Live scoring', 'Tap a player, tap the play. Scores update on every screen.'],
  ['Brackets and standings', 'Round robin or elimination, built for you or by hand.'],
  ['A link anyone can watch', 'Fans follow along on their phones. No account needed.'],
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from ?? '/dashboard'

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password)
        setInfo('Account created. Check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        await signInWithEmail(email, password)
        navigate(redirectTo, { replace: true })
      }
    } catch (err) {
      console.error('Auth failed:', err)
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    try {
      await signInWithGoogle()
      // Supabase redirects the browser away for OAuth -- nothing more to do here.
    } catch (err) {
      console.error('Google sign-in failed:', err)
      setError(err.message ?? 'Could not start Google sign-in.')
    }
  }

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent'

  return (
    <div className="min-h-screen w-full relative overflow-hidden text-white">
      {/* Emerald Void */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* ---------- Left: brand panel (desktop only) ---------- */}
        <aside className="hidden lg:flex relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
          <HoopArt className="absolute -top-4 right-10 w-56 text-emerald-400/15" />
          <SpikeArt className="absolute bottom-20 left-0 w-full max-w-md text-emerald-400/15" />

          <Link to="/" className="relative text-2xl font-display font-bold tracking-wide text-emerald-400">
            Sylve
          </Link>

          <div className="relative max-w-md">
            <h2 className="text-5xl font-display font-bold tracking-wide leading-tight">
              Run your league. <span className="text-emerald-400">Live.</span>
            </h2>
            <p className="text-white/60 mt-4 text-lg">
              Basketball, volleyball and badminton scoring for barangay leagues, school intramurals and everyone in between.
            </p>

            <ul className="mt-8 space-y-4">
              {PERKS.map(([title, text]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 text-xs">✓</span>
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-sm text-white/50">{text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative text-xs text-white/30">Watching live scores never needs an account.</div>
        </aside>

        {/* ---------- Right: form ---------- */}
        <main className="relative flex items-center justify-center px-4 py-10">
          {/* faint art on phones, where the brand panel is hidden */}
          <HoopArt className="lg:hidden absolute -top-6 -right-6 w-40 text-emerald-400/10" />
          <SpikeArt className="lg:hidden absolute bottom-0 left-0 w-72 text-emerald-400/10" />

          <div className="relative w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <Link to="/" className="text-sm text-white/50 hover:text-white/80">← Back home</Link>
              <Link to="/" className="lg:hidden text-lg font-display font-bold tracking-wide text-emerald-400">Sylve</Link>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-7 shadow-2xl shadow-black/40">
              <h1 className="text-2xl font-display font-bold tracking-wide mb-1">
                {mode === 'signin' ? 'Welcome back' : 'Create your organizer account'}
              </h1>
              <p className="text-white/60 text-sm mb-6">
                {mode === 'signin'
                  ? 'Sign in to manage your tournaments and score games.'
                  : 'Free to start. You need an account to create tournaments and score games.'}
              </p>

              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 font-medium py-3 mb-5 transition"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/40">or use email</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required
                  className={inputCls}
                />
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (6+ characters)"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    className={`${inputCls} pr-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50 hover:text-white/80"
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}
                {info && <p className="text-sm text-emerald-300">{info}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 transition disabled:opacity-50"
                >
                  {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p className="text-sm text-white/50 text-center mt-5">
                {mode === 'signin' ? "New to Sylve?" : 'Already have an account?'}{' '}
                <button
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </p>

              <p className="text-[11px] text-white/35 text-center mt-4">
                By continuing you agree to our{' '}
                <Link to="/terms" className="underline hover:text-white/70">Terms</Link> and{' '}
                <Link to="/privacy" className="underline hover:text-white/70">Privacy &amp; Cookies</Link>.
              </p>
            </div>

            <p className="text-center text-sm text-white/50 mt-5">
              Just want to watch a game?{' '}
              <Link to="/watch" className="text-emerald-400 hover:text-emerald-300">Watch live, no account</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

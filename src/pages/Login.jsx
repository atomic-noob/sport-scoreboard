import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from ?? '/dashboard'

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400'

  return (
    <div className="min-h-screen w-full relative overflow-hidden text-white flex items-center justify-center px-4">
      {/* Emerald Void */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <Link to="/" className="text-sm text-white/50 hover:text-white/80">← Back home</Link>
          <Link to="/" className="text-lg font-display font-bold tracking-wide text-emerald-400">Sylve</Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
          <h1 className="text-xl font-display font-bold tracking-wide mb-1">
            {mode === 'signin' ? 'Sign in' : 'Create an organizer account'}
          </h1>
          <p className="text-white/60 text-sm mb-5">
            Needed to create tournaments and score games. Watching live scores never requires an account.
          </p>

          <button
            onClick={handleGoogle}
            className="w-full rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 font-medium py-2.5 mb-4 transition"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/40">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className={inputCls}
            />

            {error && <p className="text-xs text-red-400">{error}</p>}
            {info && <p className="text-xs text-emerald-300">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium py-2.5 transition disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>

          <p className="text-xs text-white/50 text-center mt-4">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

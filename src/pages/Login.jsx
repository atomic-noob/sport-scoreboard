import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from ?? '/basketball'

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

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-sm text-ink-faint hover:text-ink-dim">← Back home</Link>

        <div className="rounded-xl border border-line bg-panel p-6 mt-3">
          <h1 className="text-xl font-display font-bold tracking-wide text-ink mb-1">
            {mode === 'signin' ? 'Sign in' : 'Create an organizer account'}
          </h1>
          <p className="text-ink-dim text-sm mb-5">
            Needed to create tournaments and score games. Watching live scores never requires an account.
          </p>

          <button
            onClick={handleGoogle}
            className="w-full rounded-lg border border-line-strong bg-panel-alt hover:bg-panel-raised text-ink font-medium py-2.5 mb-4 transition"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-faint">or</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />

            {error && <p className="text-xs text-live">{error}</p>}
            {info && <p className="text-xs text-accent">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium py-2.5 transition disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>

          <p className="text-xs text-ink-faint text-center mt-4">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
              className="text-accent hover:text-accent-strong font-medium"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

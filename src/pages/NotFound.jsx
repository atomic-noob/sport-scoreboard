import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const { user } = useAuth()
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-5 text-white"
      style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
    >
      <div className="text-center max-w-sm">
        <p className="text-xs font-semibold tracking-widest text-emerald-300 uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl font-display font-bold tracking-wide">Page not found</h1>
        <p className="mt-3 text-sm text-white/60">
          This link does not lead anywhere. It may be mistyped, or the tournament may have been removed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={user ? '/dashboard' : '/'} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 transition">
            {user ? 'Go to dashboard' : 'Go home'}
          </Link>
          <Link to="/watch" className="rounded-lg border border-white/15 text-white/80 hover:bg-white/5 text-sm font-medium px-4 py-2 transition">
            Watch live
          </Link>
        </div>
      </div>
    </div>
  )
}

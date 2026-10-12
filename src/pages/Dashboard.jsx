import { Link } from 'react-router-dom'
import { Tv, Layers, ArrowRight, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SportIcon from '../components/SportIcon'

const SPORTS = [
  { id: 'basketball', name: 'Basketball', ready: true, hint: 'Tournaments, live scoring, brackets and leaderboards' },
  { id: 'volleyball', name: 'Volleyball', ready: true, hint: 'Sets, rotations, libero, subs and player stats' },
  { id: 'badminton', name: 'Badminton', ready: false },
  { id: 'soccer', name: 'Soccer', ready: false },
  { id: 'tennis', name: 'Tennis', ready: false },
  { id: 'pickleball', name: 'Pickleball', ready: false },
]

export default function Dashboard() {
  const { user } = useAuth()
  const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full relative overflow-hidden text-white">
      {/* Emerald Void */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-start justify-between mb-1 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-wide">
              Welcome to <span className="text-emerald-400">Sylve</span>
            </h1>
            {user?.email && <p className="text-xs text-white/40 mt-1">{user.email}</p>}
          </div>
          <a
            href="/watch"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 transition flex items-center gap-1.5"
          >
            <Tv className="w-4 h-4" /> Watch live
          </a>
        </div>
        <p className="text-white/60 mb-8">Pick a sport to set up or score a game.</p>

        <Link
          to="/events"
          className="group flex items-center gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5 mb-8 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/60 hover:bg-emerald-400/10"
        >
          <span className="w-11 h-11 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0"><Layers className="w-5 h-5" /></span>
          <span className="flex-1 min-w-0">
            <span className="block font-medium">Events</span>
            <span className="block text-sm text-white/60">Group basketball and volleyball tournaments under one event and one public link</span>
          </span>
          <ArrowRight className="w-5 h-5 text-emerald-400 transition group-hover:translate-x-1" />
        </Link>

        <h2 className="text-xs font-semibold uppercase text-white/40 mb-3">Sports</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {SPORTS.map((sport) =>
            sport.ready ? (
              <Link
                key={sport.id}
                to={`/${sport.id}`}
                className={`${glass} group p-6 text-center font-medium transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-400/5 hover:shadow-lg hover:shadow-emerald-500/10`}
              >
                <div className="mx-auto mb-3 w-12 h-12 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center transition duration-300 group-hover:scale-110"><SportIcon sport={sport.id} className="w-7 h-7" /></div>
                {sport.name}
                <p className="text-xs font-normal text-emerald-200/80 max-h-0 opacity-0 overflow-hidden transition-all duration-300 group-hover:max-h-16 group-hover:opacity-100 group-hover:mt-2">
                  {sport.hint}
                </p>
              </Link>
            ) : (
              <div
                key={sport.id}
                className={`${glass} p-6 text-center font-medium text-white/30 cursor-not-allowed`}
              >
                <div className="mx-auto mb-3 w-12 h-12 rounded-xl border border-white/10 bg-white/5 text-white/30 flex items-center justify-center">
                  <Lock className="w-6 h-6" strokeWidth={1.75} />
                </div>
                {sport.name}
                <div className="text-xs mt-1 font-normal">Coming soon</div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

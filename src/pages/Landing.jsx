import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTournaments } from '../lib/adminData'

const FEATURES = [
  {
    emoji: '🏀',
    title: 'Live Scoring',
    description: 'Tap to score in real time -- points, fouls, stats, timeouts, and substitutions, all tracked as they happen.',
  },
  {
    emoji: '🏆',
    title: 'Brackets & Standings',
    description: 'Round-robin schedules and elimination brackets, generated automatically or built by hand -- your call.',
  },
  {
    emoji: '📊',
    title: 'Stats & Leaderboards',
    description: 'Full box scores, Player of the Game, and leaderboards -- per tournament or across a player\'s whole career.',
  },
  {
    emoji: '📺',
    title: 'Public Live Viewing',
    description: 'Share a link and anyone can watch the score update live -- no account, no download, just open and watch.',
  },
]

const SPORT_EMOJI = { basketball: '🏀', volleyball: '🏐', badminton: '🏸', soccer: '⚽', tennis: '🎾', pickleball: '🥒' }

export default function Landing() {
  const { user } = useAuth()
  const [recentTournaments, setRecentTournaments] = useState([])

  useEffect(() => {
    getTournaments()
      .then((all) => setRecentTournaments(all.slice(0, 3)))
      .catch((err) => console.warn('Could not load recent tournaments for landing page:', err.message))
  }, [])

  return (
    <div className="min-h-screen bg-page">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-wide text-ink mb-4">
          Score Every Game. <span className="text-accent">Instantly.</span>
        </h1>
        <p className="text-ink-dim text-lg mb-8 max-w-xl mx-auto">
          Run tournaments, score live games from your phone, and let anyone watch along --
          no accounts needed for spectators, no spreadsheets for you.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to={user ? '/dashboard' : '/login'}
            className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition"
          >
            Get Started
          </Link>
          <Link
            to="/watch"
            className="rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt font-medium px-6 py-3 transition"
          >
            📺 Watch Live
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-panel p-5">
              <div className="text-2xl mb-2">{f.emoji}</div>
              <h3 className="font-display font-bold tracking-wide text-ink mb-1">{f.title}</h3>
              <p className="text-ink-dim text-sm">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recently active tournaments -- real data as social proof */}
      {recentTournaments.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <h2 className="text-xs font-semibold text-ink-faint uppercase mb-3">Happening on the platform</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentTournaments.map((t) => (
              <Link
                key={t.id}
                to={`/watch/${t.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-line bg-panel p-4 hover:border-accent hover:shadow-md transition"
              >
                <div className="text-lg mb-1">{SPORT_EMOJI[t.sport] ?? '🏆'}</div>
                <p className="font-medium text-ink text-sm truncate">{t.name}</p>
                {t.level && <p className="text-xs text-ink-faint mt-0.5">{t.level}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Closing CTA */}
      <div className="border-t border-line">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-ink-dim mb-4">Ready to run your own tournament?</p>
          <Link
            to={user ? '/dashboard' : '/login'}
            className="rounded-lg bg-accent hover:bg-accent-strong text-on-accent font-medium px-6 py-3 transition inline-block"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  )
}

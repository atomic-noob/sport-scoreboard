import { Link } from 'react-router-dom'

const SPORTS = [
  { id: 'basketball', name: 'Basketball', emoji: '🏀', ready: true },
  { id: 'volleyball', name: 'Volleyball', emoji: '🏐', ready: true },
  { id: 'badminton', name: 'Badminton', emoji: '🏸', ready: false },
  { id: 'soccer', name: 'Soccer', emoji: '⚽', ready: false },
  { id: 'tennis', name: 'Tennis', emoji: '🎾', ready: false },
  { id: 'pickleball', name: 'Pickleball', emoji: '🥒', ready: false },
]

export default function Dashboard() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-1 gap-4">
        <h1 className="text-3xl font-display font-bold tracking-wide text-ink">All-Sport Scoreboard</h1>
        <a
          href="/watch"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-sm font-medium px-4 py-2 transition flex items-center gap-1.5"
        >
          📺 Watch Live
        </a>
      </div>
      <p className="text-ink-dim mb-6">Pick a sport to set up or score a game.</p>

      <Link
        to="/events"
        className="flex items-center gap-3 rounded-xl border border-accent bg-accent-soft p-4 mb-6 transition hover:shadow-md text-ink"
      >
        <span className="text-2xl">🏟️</span>
        <span>
          <span className="block font-medium">Events</span>
          <span className="block text-xs text-ink-dim">Group basketball and volleyball tournaments under one event</span>
        </span>
      </Link>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {SPORTS.map((sport) =>
          sport.ready ? (
            <Link
              key={sport.id}
              to={`/${sport.id}`}
              className="rounded-xl border border-line bg-panel p-5 text-center font-medium transition hover:border-accent hover:shadow-md cursor-pointer text-ink"
            >
              <div className="text-2xl mb-1">{sport.emoji}</div>
              {sport.name}
            </Link>
          ) : (
            <div
              key={sport.id}
              className="rounded-xl border border-line bg-page p-5 text-center font-medium text-ink-faint cursor-not-allowed"
            >
              <div className="text-2xl mb-1 opacity-40">{sport.emoji}</div>
              {sport.name}
              <div className="text-xs mt-1 font-normal">Coming soon</div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

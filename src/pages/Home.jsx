import { Link } from 'react-router-dom'

const SPORTS = [
  { id: 'basketball', name: 'Basketball', ready: true },
  { id: 'volleyball', name: 'Volleyball', ready: false },
  { id: 'badminton', name: 'Badminton', ready: false },
  { id: 'soccer', name: 'Soccer', ready: false },
  { id: 'tennis', name: 'Tennis', ready: false },
  { id: 'pickleball', name: 'Pickleball', ready: false },
]

export default function Home() {
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
      <p className="text-ink-dim mb-8">Pick a sport to set up or score a game.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {SPORTS.map((sport) =>
          sport.ready ? (
            <Link
              key={sport.id}
              to={`/${sport.id}`}
              className="rounded-xl border border-line bg-panel p-5 text-center font-medium transition hover:border-accent hover:shadow-md cursor-pointer text-ink"
            >
              {sport.name}
            </Link>
          ) : (
            <div
              key={sport.id}
              className="rounded-xl border border-line bg-page p-5 text-center font-medium text-ink-faint cursor-not-allowed"
            >
              {sport.name}
              <div className="text-xs mt-1 font-normal">Coming soon</div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

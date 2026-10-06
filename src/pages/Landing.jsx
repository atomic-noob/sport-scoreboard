import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTournaments } from '../lib/adminData'
import { supabase } from '../lib/supabaseClient'

const FEATURES = [
  {
    emoji: '🏀',
    title: 'Live Scoring',
    description: 'Tap to score in real time from your phone.',
    more: 'Points, fouls, timeouts and substitutions for basketball. Sets, rotations, a libero and per-player stats for volleyball.',
  },
  {
    emoji: '🏆',
    title: 'Brackets & Standings',
    description: 'Round-robin and elimination, built for you.',
    more: 'Generate a schedule automatically or build the bracket by hand. Standings update the moment a game ends.',
  },
  {
    emoji: '📊',
    title: 'Stats & Leaderboards',
    description: 'Box scores and leaders for every sport.',
    more: 'Player of the Game, kills, aces, rebounds and hitting % — per tournament, with team leaderboards too.',
  },
  {
    emoji: '📺',
    title: 'Public Live Viewing',
    description: 'Share a link. Anyone can watch.',
    more: 'No account and no download for spectators. Scores, the court and the box score update live.',
  },
  {
    emoji: '🏟️',
    title: 'Multi-sport Events',
    description: 'One event, one link, every sport.',
    more: 'Group a basketball and a volleyball tournament under a single event page that spectators can follow.',
  },
  {
    emoji: '📱',
    title: 'Built for the Sideline',
    description: 'Fits one screen. No scrolling mid-game.',
    more: 'The scoring screen keeps the court, scoreboard and actions visible, in portrait or landscape. A refresh never loses the match.',
  },
]

const SPORTS = [
  { emoji: '🏀', name: 'Basketball', ready: true },
  { emoji: '🏐', name: 'Volleyball', ready: true },
  { emoji: '🏸', name: 'Badminton', ready: false },
  { emoji: '⚽', name: 'Soccer', ready: false },
  { emoji: '🎾', name: 'Tennis', ready: false },
  { emoji: '🥒', name: 'Pickleball', ready: false },
]

const STEPS = [
  { n: '1', title: 'Create', text: 'Set up a tournament or a multi-sport event, add teams and rosters.' },
  { n: '2', title: 'Score', text: 'Run each game from your phone. Every action is saved as it happens.' },
  { n: '3', title: 'Share', text: 'Send one link. Spectators follow scores, standings and leaders live.' },
]

const SPORT_EMOJI = { basketball: '🏀', volleyball: '🏐', badminton: '🏸', soccer: '⚽', tennis: '🎾', pickleball: '🥒' }

export default function Landing() {
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [matches, setMatches] = useState([])

  useEffect(() => {
    getTournaments()
      .then(setTournaments)
      .catch((err) => console.warn('Could not load tournaments for landing page:', err.message))
  }, [])

  // A small peek at the global scoreboard: the latest games across every tournament.
  useEffect(() => {
    async function loadMatches() {
      const { data: rows, error } = await supabase
        .from('matches')
        .select('id, tournament_id, team_a_id, team_b_id, team_a_score, team_b_score, status')
        .in('status', ['live', 'completed'])
        .order('created_at', { ascending: false })
        .limit(6)
      if (error || !rows?.length) return
      const teamIds = [...new Set(rows.flatMap((r) => [r.team_a_id, r.team_b_id]).filter(Boolean))]
      const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds)
      const nameOf = new Map((teams ?? []).map((t) => [t.id, t.name]))
      setMatches(rows.map((r) => ({ ...r, nameA: nameOf.get(r.team_a_id) ?? 'TBD', nameB: nameOf.get(r.team_b_id) ?? 'TBD' })))
    }
    loadMatches().catch((err) => console.warn('Could not load matches for landing page:', err.message))
  }, [])

  const tournamentById = new Map(tournaments.map((t) => [t.id, t]))
  const liveCount = matches.filter((m) => m.status === 'live').length
  const cta = user ? '/dashboard' : '/login'
  const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'

  return (
    <div className="min-h-screen w-full relative overflow-hidden text-white">
      {/* Emerald Void */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-display font-bold tracking-wide">
            <span className="text-emerald-400">Sylve</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link to="/watch" className="px-3 py-2 text-white/70 hover:text-white transition">📺 Watch Live</Link>
            <Link
              to={cta}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-2 transition"
            >
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <header className="max-w-7xl mx-auto px-5 sm:px-8 min-h-[calc(100vh-4rem)] grid lg:grid-cols-2 gap-10 items-center py-10">
          <div>
            <p className="inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-xs font-medium px-3 py-1 mb-5">
              Basketball · Volleyball · more coming
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-wide leading-[1.05] mb-5">
              Score every game. <span className="text-emerald-400">Instantly.</span>
            </h1>
            <p className="text-white/70 text-lg sm:text-xl max-w-xl mb-8">
              Run tournaments, score live games from your phone, and let anyone watch along —
              no accounts for spectators, no spreadsheets for you.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={cta}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-7 py-3.5 transition"
              >
                Get Started
              </Link>
              <Link
                to="/watch"
                className="rounded-lg border border-white/20 text-white/80 hover:bg-white/10 font-medium px-7 py-3.5 transition"
              >
                📺 Watch Live
              </Link>
            </div>
          </div>

          {/* Sample scoreboard that tilts on hover */}
          <div className="group relative mx-auto w-full max-w-md [perspective:1000px]">
            <div className="absolute -inset-6 rounded-3xl bg-emerald-500/10 blur-3xl group-hover:bg-emerald-500/20 transition" />
            <div className={`${glass} relative p-5 transition duration-300 group-hover:[transform:rotateX(4deg)_rotateY(-6deg)_scale(1.02)] group-hover:border-emerald-400/40`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold uppercase text-white/50">Sample match</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-5">
                <div>
                  <p className="text-sm text-white/70 truncate">Spikers</p>
                  <p className="text-5xl font-display font-bold text-emerald-400">21</p>
                </div>
                <div className="text-center text-[11px] text-white/40">SET 3<br />1 – 1</div>
                <div className="text-right">
                  <p className="text-sm text-white/70 truncate">Hawks</p>
                  <p className="text-5xl font-display font-bold text-white">19</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-white/60">
                {[['Kills', '14 · 11'], ['Aces', '4 · 2'], ['Blocks', '5 · 3']].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 py-2">
                    <p className="text-white/40">{k}</p>
                    <p className="text-white text-sm font-medium">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Numbers */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-6">
          <div className={`${glass} grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10`}>
            {[
              [tournaments.length || '—', 'Tournaments'],
              [liveCount, 'Live right now'],
              ['2', 'Sports ready'],
              ['0', 'Accounts for spectators'],
            ].map(([v, l]) => (
              <div key={l} className="px-4 py-5 text-center">
                <p className="text-3xl font-display font-bold text-emerald-400">{v}</p>
                <p className="text-xs text-white/50 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mb-2">Everything a tournament needs</h2>
          <p className="text-white/60 mb-8 max-w-2xl">Hover a card to see what is inside.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`${glass} group p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-400/5`}
              >
                <div className="text-3xl mb-3">{f.emoji}</div>
                <h3 className="font-display font-bold tracking-wide text-lg mb-1">{f.title}</h3>
                <p className="text-white/60 text-sm">{f.description}</p>
                <p className="text-emerald-200/80 text-sm max-h-0 opacity-0 overflow-hidden transition-all duration-300 group-hover:max-h-32 group-hover:opacity-100 group-hover:mt-3">
                  {f.more}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Global scoreboard peek */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mb-2">The global scoreboard</h2>
              <p className="text-white/60">A peek at the latest games across every tournament.</p>
            </div>
            <Link to="/watch" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 shrink-0">
              See all →
            </Link>
          </div>

          {matches.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.map((m) => {
                const t = tournamentById.get(m.tournament_id)
                const live = m.status === 'live'
                const sets = t?.sport === 'volleyball'
                return (
                  <Link
                    key={m.id}
                    to={`/watch/${m.tournament_id}/match/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${glass} group block p-4 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-3">
                      <span className="text-white/50 truncate">
                        {SPORT_EMOJI[t?.sport] ?? '🏆'} {t?.name ?? 'Tournament'}
                      </span>
                      {live ? (
                        <span className="flex items-center gap-1 text-red-400 font-medium shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
                        </span>
                      ) : (
                        <span className="text-white/40 shrink-0">Final</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-white/80 truncate">{m.nameA}</span>
                      <span className="text-2xl font-display font-bold text-emerald-400">{m.team_a_score ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-white/80 truncate">{m.nameB}</span>
                      <span className="text-2xl font-display font-bold">{m.team_b_score ?? 0}</span>
                    </div>
                    <p className="text-xs text-emerald-300 max-h-0 opacity-0 overflow-hidden transition-all duration-300 group-hover:max-h-8 group-hover:opacity-100 group-hover:mt-3">
                      {sets ? 'Scores shown in sets · ' : ''}Open the live match →
                    </p>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className={`${glass} p-10 text-center text-white/50 text-sm`}>
              Games will show up here as soon as tournaments start.
            </div>
          )}
        </section>

        {/* Sports */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mb-6">Sports</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SPORTS.map((s) => (
              <div
                key={s.name}
                className={`${glass} p-5 text-center transition duration-300 ${
                  s.ready ? 'hover:-translate-y-1 hover:border-emerald-400/40' : 'opacity-50'
                }`}
              >
                <div className="text-3xl mb-1">{s.emoji}</div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className={`text-[11px] mt-0.5 ${s.ready ? 'text-emerald-400' : 'text-white/40'}`}>
                  {s.ready ? 'Ready' : 'Coming soon'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mb-6">How it works</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className={`${glass} p-6 transition duration-300 hover:border-emerald-400/40`}>
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-black font-bold flex items-center justify-center mb-3">{s.n}</div>
                <h3 className="font-display font-bold tracking-wide text-lg mb-1">{s.title}</h3>
                <p className="text-white/60 text-sm">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 px-6 py-14 text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-wide mb-3">Ready to run your own tournament?</h2>
            <p className="text-white/60 mb-6">Set it up in minutes. Share one link.</p>
            <Link
              to={cta}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-8 py-3.5 transition inline-block"
            >
              Get Started
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
            <span className="font-display font-bold tracking-wide text-emerald-400 text-sm">Sylve</span>
            <span>Live scoring for every game.</span>
            <Link to="/watch" className="hover:text-white/70">📺 Watch Live</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}

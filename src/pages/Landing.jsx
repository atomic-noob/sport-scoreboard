import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTournaments } from '../lib/adminData'
import { supabase } from '../lib/supabaseClient'
import { Tv, Trophy, BarChart3, Layers, Zap, Check } from 'lucide-react'
import SportIcon from '../components/SportIcon'
import { OPEN_COOKIE_SETTINGS } from '../lib/cookieConsent'

// Optional real photos. Leave '' to use the drawn court and net.
// When you add one (e.g. '/photos/basketball.webp' in the public folder), it is shown
// behind the drawing with an emerald tint. Only use photos you have the licence for.
const PHOTOS = { basketball: '', volleyball: '', badminton: '', pickleball: '', tennis: '', tabletennis: '' }

const SPORTS = {
  basketball: {
    label: 'Basketball',
    word: 'Hoops',
    line: 'Fouls, timeouts, quarters and a box score for every player.',
    sample: { a: 'Hawks', b: 'Lions', sa: 68, sb: 64, tag: 'Q4 · 2:41', stats: [['PTS', '24 · 19'], ['REB', '31 · 28'], ['AST', '14 · 11']] },
  },
  volleyball: {
    label: 'Volleyball',
    word: 'Spikes',
    line: 'Sets, rotations, a libero and kills, aces and blocks as they happen.',
    sample: { a: 'Spikers', b: 'Eagles', sa: 21, sb: 19, tag: 'SET 3 · 1–1', stats: [['KILLS', '14 · 11'], ['ACES', '4 · 2'], ['BLOCKS', '5 · 3']] },
  },
  badminton: {
    label: 'Badminton',
    word: 'Smash',
    line: 'Rally-point games to 21, singles or doubles, with the serve court tracked for you.',
    sample: { a: 'Smashers', b: 'Shuttlers', sa: 19, sb: 17, tag: 'GAME 3 · 1–1', stats: [['GAMES', '1 · 1'], ['SERVE', 'Right court'], ['TO WIN', '21, by 2']] },
  },
}

SPORTS.pickleball = {
  label: 'Pickleball',
  word: 'Dink',
  line: 'Side-out scoring, server 1 and 2, and the score call, with the kitchen drawn in.',
  sample: { a: 'Dinkers', b: 'Bangers', sa: 9, sb: 7, tag: 'GAME 2 · 1–0', stats: [['CALL', '9-7-2'], ['GAMES', '1 · 0'], ['TO WIN', '11, by 2']] },
}

SPORTS.tennis = {
  label: 'Tennis',
  word: 'Ace',
  line: 'Games, sets and tiebreaks, deuce or no-ad, with the serve and change of ends tracked for you.',
  sample: { a: 'Aces', b: 'Baseliners', sa: 40, sb: 30, tag: 'SET 2 · 1–0', stats: [['SETS', '1 · 0'], ['SERVE', 'Right court'], ['TIEBREAK', 'At 6–6']] },
}

SPORTS.tabletennis = {
  label: 'Table Tennis',
  word: 'Spin',
  line: 'Games to 11, win by 2, with the serve changing every two points and tracked for you.',
  sample: { a: 'Spinners', b: 'Loopers', sa: 9, sb: 7, tag: 'GAME 3 · 1–1', stats: [['GAMES', '1 · 1'], ['SERVE', 'Spinners'], ['TO WIN', '11, by 2']] },
}

const BENTO = [
  { Icon: Zap, title: 'Score from your phone', text: 'One screen. Court, scoreboard and actions, no scrolling. A refresh never loses the match.', span: 'lg:col-span-2' },
  { Icon: Tv, title: 'Anyone can watch', text: 'Share a link. No account, no download.' },
  { Icon: Trophy, title: 'Brackets & standings', text: 'Round-robin or elimination, automatic or by hand.' },
  { Icon: BarChart3, title: 'Leaders & box scores', text: 'Points, rebounds, kills, aces, hitting %. Per tournament.' },
  { Icon: Layers, title: 'One event, every sport', text: 'Group basketball, volleyball, badminton, pickleball, tennis and table tennis tournaments under a single link.', span: 'lg:col-span-3' },
]

const STEPS = [
  { n: '01', title: 'Create', text: 'Set up a tournament or a multi-sport event. Add teams and rosters.' },
  { n: '02', title: 'Score', text: 'Run each game from your phone. Every action is saved as it happens.' },
  { n: '03', title: 'Share', text: 'Send one link. Spectators follow scores, standings and leaders live.' },
]

/* ---------- Drawings ---------- */

function BasketballArt() {
  // Half court seen from above, hoop and net in the corner.
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="10" y="10" width="380" height="280" rx="4" opacity=".5" />
      <rect x="140" y="10" width="120" height="110" opacity=".6" />
      <circle cx="200" cy="120" r="42" opacity=".6" />
      <path d="M52 10 V70 A150 150 0 0 0 348 70 V10" opacity=".5" />
      <path d="M170 24 H230" strokeWidth="4" />
      <circle cx="200" cy="38" r="9" strokeWidth="3" className="text-emerald-300" />
      <g className="text-emerald-300" strokeWidth="1.5" opacity=".9">
        <path d="M191 40 L196 62 M197 41 L199 62 M203 41 L201 62 M209 40 L204 62 M194 46 H206 M195 53 H205" />
      </g>
      <circle cx="200" cy="205" r="14" className="text-emerald-400" strokeWidth="3" />
    </svg>
  )
}

function VolleyballArt() {
  // Court from above with the net across the middle.
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="10" y="30" width="380" height="240" rx="4" opacity=".5" />
      <path d="M130 30 V270 M270 30 V270" opacity=".45" />
      <path d="M200 14 V286" strokeWidth="3" className="text-emerald-300" />
      <g className="text-emerald-300" strokeWidth="1" opacity=".55">
        {Array.from({ length: 12 }).map((_, i) => (
          <path key={i} d={`M${194} ${30 + i * 20} H${206}`} />
        ))}
      </g>
      <circle cx="200" cy="14" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="200" cy="286" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="120" cy="150" r="14" className="text-emerald-400" strokeWidth="3" />
      <path d="M120 136 V164 M106 150 H134" className="text-emerald-400" strokeWidth="1.5" opacity=".7" />
    </svg>
  )
}

function BadmintonArt() {
  // Doubles court from above: net across the middle, service lines and centre lines.
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="20" y="30" width="360" height="240" rx="4" opacity=".5" />
      <path d="M20 66 H380 M20 234 H380" opacity=".45" />
      <path d="M92 30 V270 M308 30 V270" opacity=".45" />
      <path d="M20 150 H92 M308 150 H380" opacity=".45" />
      <path d="M200 14 V286" strokeWidth="3" className="text-emerald-300" />
      <circle cx="200" cy="14" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="200" cy="286" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="150" cy="105" r="14" className="text-emerald-400" strokeWidth="3" />
      <circle cx="250" cy="195" r="14" className="text-emerald-400" strokeWidth="3" />
    </svg>
  )
}

function PickleballArt() {
  // Court from above: net across the middle, a kitchen on each side and centre lines behind them.
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="20" y="40" width="360" height="220" rx="4" opacity=".5" />
      <path d="M142 40 V260 M258 40 V260" opacity=".45" />
      <path d="M20 150 H142 M258 150 H380" opacity=".45" />
      <path d="M200 24 V276" strokeWidth="3" className="text-emerald-300" />
      <circle cx="200" cy="24" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="200" cy="276" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="80" cy="95" r="14" className="text-emerald-400" strokeWidth="3" />
      <circle cx="320" cy="205" r="14" className="text-emerald-400" strokeWidth="3" />
    </svg>
  )
}

function TennisArt() {
  // Court from above: net across the middle, singles sidelines, service lines and the centre service line.
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="20" y="30" width="360" height="240" rx="4" opacity=".5" />
      <path d="M20 58 H380 M20 242 H380" opacity=".45" />
      <path d="M110 58 V242 M290 58 V242" opacity=".45" />
      <path d="M110 150 H290" opacity=".45" />
      <path d="M200 14 V286" strokeWidth="3" className="text-emerald-300" />
      <circle cx="200" cy="14" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="200" cy="286" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="60" cy="100" r="14" className="text-emerald-400" strokeWidth="3" />
      <circle cx="340" cy="200" r="14" className="text-emerald-400" strokeWidth="3" />
    </svg>
  )
}

function RacketArt({ className = '' }) {
  return (
    <svg viewBox="0 0 120 150" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <ellipse cx="48" cy="48" rx="30" ry="38" opacity=".8" />
      <path d="M28 30 L68 66 M68 30 L28 66 M20 48 H76 M48 12 V84" opacity=".35" strokeWidth="1.5" />
      <path d="M48 86 V132" strokeWidth="9" opacity=".7" />
      <circle cx="96" cy="108" r="14" className="text-emerald-300" strokeWidth="3.5" />
      <path d="M84 100 q12 8 24 0 M84 116 q12 -8 24 0" className="text-emerald-300" strokeWidth="2" opacity=".8" />
    </svg>
  )
}

function TableArt() {
  // Table from above: net across the middle, a centre line along the length.
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="50" y="70" width="300" height="160" rx="4" opacity=".5" />
      <path d="M50 150 H350" opacity=".4" strokeDasharray="6 6" />
      <path d="M200 52 V248" strokeWidth="3" className="text-emerald-300" />
      <circle cx="200" cy="52" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="200" cy="248" r="5" className="text-emerald-300" fill="currentColor" />
      <circle cx="26" cy="150" r="14" className="text-emerald-400" strokeWidth="3" />
      <circle cx="374" cy="150" r="14" className="text-emerald-400" strokeWidth="3" />
    </svg>
  )
}

function BatArt({ className = '' }) {
  return (
    <svg viewBox="0 0 120 150" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="52" cy="52" r="38" opacity=".8" />
      <path d="M52 90 V134" strokeWidth="11" opacity=".7" />
      <circle cx="98" cy="112" r="11" className="text-emerald-300" strokeWidth="3.5" />
    </svg>
  )
}

function PaddleArt({ className = '' }) {
  return (
    <svg viewBox="0 0 120 150" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <rect x="22" y="8" width="60" height="78" rx="28" opacity=".8" />
      <path d="M52 86 V132" strokeWidth="9" opacity=".7" />
      <circle cx="92" cy="104" r="16" className="text-emerald-300" strokeWidth="3.5" />
      <path d="M85 98h.01M96 99h.01M90 108h.01M98 110h.01M86 111h.01" className="text-emerald-300" strokeWidth="3" />
    </svg>
  )
}

function ShuttleArt({ className = '' }) {
  return (
    <svg viewBox="0 0 120 150" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M42 100 a18 18 0 0 0 36 0 z" className="text-emerald-300" strokeWidth="4" />
      <path d="M42 100 L18 20 M78 100 L102 20 M60 100 V12" opacity=".8" />
      <path d="M24 38 Q60 52 96 38 M31 66 Q60 80 89 66" opacity=".7" />
    </svg>
  )
}

function HoopArt({ className = '' }) {
  return (
    <svg viewBox="0 0 120 150" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <rect x="20" y="4" width="80" height="50" rx="3" opacity=".6" />
      <rect x="45" y="26" width="30" height="22" opacity=".6" />
      <ellipse cx="60" cy="62" rx="24" ry="7" strokeWidth="4" className="text-emerald-300" />
      <g strokeWidth="1.6" opacity=".9">
        <path d="M37 64 L48 130 M45 68 L54 132 M53 69 L58 134 M61 69 L62 134 M69 69 L66 134 M77 68 L72 132 M83 64 L74 130" />
        <path d="M40 80 H80 M43 96 H77 M46 112 H74" />
      </g>
    </svg>
  )
}

function NetArt({ className = '' }) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 8 V112 M148 8 V112" strokeWidth="4" opacity=".7" />
      <path d="M12 22 H148" strokeWidth="5" className="text-emerald-300" />
      <g strokeWidth="1.2" opacity=".75">
        {Array.from({ length: 13 }).map((_, i) => (
          <path key={`v${i}`} d={`M${24 + i * 10} 22 V86`} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <path key={`h${i}`} d={`M12 ${34 + i * 11} H148`} />
        ))}
      </g>
      <path d="M12 86 H148" strokeWidth="3" opacity=".7" />
    </svg>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const [sport, setSport] = useState('basketball')
  const [tournaments, setTournaments] = useState([])
  const [matches, setMatches] = useState([])

  useEffect(() => {
    getTournaments()
      .then(setTournaments)
      .catch((err) => console.warn('Could not load tournaments for landing page:', err.message))
  }, [])

  useEffect(() => {
    async function loadMatches() {
      const { data: rows, error } = await supabase
        .from('matches')
        .select('id, tournament_id, team_a_id, team_b_id, team_a_score, team_b_score, status')
        .in('status', ['live', 'completed'])
        .order('created_at', { ascending: false })
        .limit(8)
      if (error || !rows?.length) return
      const teamIds = [...new Set(rows.flatMap((r) => [r.team_a_id, r.team_b_id]).filter(Boolean))]
      const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds)
      const nameOf = new Map((teams ?? []).map((t) => [t.id, t.name]))
      setMatches(rows.map((r) => ({ ...r, nameA: nameOf.get(r.team_a_id) ?? 'TBD', nameB: nameOf.get(r.team_b_id) ?? 'TBD' })))
    }
    loadMatches().catch((err) => console.warn('Could not load matches for landing page:', err.message))
  }, [])

  const s = SPORTS[sport]
  const photo = PHOTOS[sport]
  const tournamentById = new Map(tournaments.map((t) => [t.id, t]))
  const liveCount = matches.filter((m) => m.status === 'live').length
  const cta = user ? '/dashboard' : '/login'
  const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'
  const outline = { WebkitTextStroke: '1.5px rgba(52,211,153,0.35)', color: 'transparent' }

  return (
    <div className="min-h-screen w-full relative overflow-hidden text-white">
      <style>{`
        @keyframes sylve-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes sylve-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        .sylve-marquee { animation: sylve-marquee 40s linear infinite; }
        .sylve-float { animation: sylve-float 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sylve-marquee, .sylve-float { animation: none } }
        .sylve-nums { font-variant-numeric: tabular-nums; }
      `}</style>

      <div
        className="fixed inset-0 z-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #072607 100%)' }}
      />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-display font-bold tracking-wide text-emerald-400">Sylve</Link>
          <div className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link to="/watch" className="px-3 py-2 text-white/70 hover:text-white transition"><span className="inline-flex items-center gap-1.5"><Tv className="w-4 h-4" /> Watch live</span></Link>
            <Link to={cta} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-2 transition">
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <header className="relative max-w-7xl mx-auto px-5 sm:px-8 min-h-[calc(100vh-4rem)] flex flex-col justify-center py-10">
          {/* Giant outlined word behind everything */}
          <div
            className="pointer-events-none select-none absolute inset-x-0 top-6 text-center font-display font-bold leading-none text-[26vw] lg:text-[20rem] opacity-80"
            style={outline}
            aria-hidden="true"
          >
            {s.word}
          </div>

          <div className="relative mb-8">
          {/* Sport toggle: one row across the top of the hero */}
              <div className="flex w-max max-w-full gap-0.5 overflow-x-auto rounded-full border border-white/15 bg-white/5 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Sport">
                {Object.entries(SPORTS).map(([key, v]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={sport === key}
                    onClick={() => setSport(key)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 sm:px-4 py-1.5 text-sm font-medium transition ${
                      sport === key ? 'bg-emerald-500 text-black' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5"><SportIcon sport={key} className="w-4 h-4" />{v.label}</span>
                  </button>
                ))}
              </div>
          </div>

          <div className="relative grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
            <div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-wide leading-[1.02] mb-5">
                Every point.
                <br />
                <span className="text-emerald-400">Every game.</span>
                <br />
                Live.
              </h1>
              <p className="text-white/70 text-lg max-w-lg mb-2">{s.line}</p>
              <p className="text-white/50 text-sm max-w-lg mb-8">
                Run tournaments, score from your phone, and let anyone watch along. No accounts for spectators, no spreadsheets for you.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to={cta} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-7 py-3.5 transition">
                  Run a tournament
                </Link>
                <Link to="/watch" className="rounded-lg border border-white/20 text-white/80 hover:bg-white/10 font-medium px-7 py-3.5 transition">
                  <span className="inline-flex items-center gap-2"><Tv className="w-4 h-4" /> Watch live</span>
                </Link>
              </div>
            </div>

            {/* Court + sample scoreboard */}
            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-8 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className={`${glass} relative aspect-[4/3] overflow-hidden text-white/40`}>
                {photo && (
                  <>
                    <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover grayscale" />
                    <div className="absolute inset-0 bg-emerald-900/60 mix-blend-multiply" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  </>
                )}
                <div className="absolute inset-0 p-3">{sport === 'basketball' ? <BasketballArt /> : sport === 'volleyball' ? <VolleyballArt /> : sport === 'badminton' ? <BadmintonArt /> : sport === 'tennis' ? <TennisArt /> : sport === 'tabletennis' ? <TableArt /> : <PickleballArt />}</div>

                <div className="absolute left-3 right-3 bottom-3 rounded-xl border border-white/10 bg-black/70 backdrop-blur p-3 text-white sylve-float">
                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <span className="uppercase font-semibold text-white/40">Sample match</span>
                    <span className="flex items-center gap-1.5 text-red-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE · {s.sample.tag}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sylve-nums">
                    <div>
                      <p className="text-xs text-white/60">{s.sample.a}</p>
                      <p className="text-3xl font-display font-bold text-emerald-400 leading-none">{s.sample.sa}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {s.sample.stats.map(([k, v]) => (
                        <div key={k} className="rounded bg-white/5 px-1.5 py-1">
                          <p className="text-[8px] text-white/40">{k}</p>
                          <p className="text-[11px] font-medium">{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/60">{s.sample.b}</p>
                      <p className="text-3xl font-display font-bold leading-none">{s.sample.sb}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Live ticker */}
        {matches.length > 0 && (
          <div className="border-y border-white/10 bg-black/40 overflow-hidden">
            <div className="flex w-max sylve-marquee gap-10 py-3 text-sm sylve-nums">
              {[...matches, ...matches].map((m, i) => {
                const t = tournamentById.get(m.tournament_id)
                return (
                  <Link
                    key={`${m.id}-${i}`}
                    to={`/watch/${m.tournament_id}/match/${m.id}`}
                    className="flex items-center gap-3 whitespace-nowrap text-white/70 hover:text-white"
                  >
                    <SportIcon sport={t?.sport} className="w-4 h-4 text-emerald-300" />
                    <span>{m.nameA}</span>
                    <span className="font-bold text-emerald-400">{m.team_a_score ?? 0}</span>
                    <span className="text-white/30">–</span>
                    <span className="font-bold text-emerald-400">{m.team_b_score ?? 0}</span>
                    <span>{m.nameB}</span>
                    {m.status === 'live' && <span className="text-[10px] font-semibold text-red-400">LIVE</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Six sports, one platform */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
          <p className="text-xs font-semibold uppercase text-emerald-400 mb-2">Six sports. One platform.</p>
          <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-wide mb-10 max-w-3xl">
            Built for the way each game is actually scored
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-5">
            {[
              { key: 'basketball', Art: HoopArt, title: 'Basketball', points: ['Quarters, fouls and timeouts', 'Player of the Game and leaderboards', 'Live court with every substitution'] },
              { key: 'volleyball', Art: NetArt, title: 'Volleyball', points: ['Sets, rotations and a libero', 'Kills, aces, blocks and hitting %', 'Reopen a set, resume after a refresh'] },
              { key: 'badminton', Art: ShuttleArt, title: 'Badminton', points: ['Rally-point games, singles or doubles', 'Serve court and change of ends tracked for you', 'Live court on the watch page'] },
              { key: 'pickleball', Art: PaddleArt, title: 'Pickleball', points: ['Side-out scoring and the score call', 'Server 1 and 2 tracked, with the kitchen on court', 'Singles or doubles, best of 1, 3 or 5'] },
              { key: 'tennis', Art: RacketArt, title: 'Tennis', points: ['Games, sets and tiebreaks, deuce or no-ad', 'Serve, court side and change of ends tracked for you', 'Singles or doubles, with an optional match tiebreak'] },
              { key: 'tabletennis', Art: BatArt, title: 'Table Tennis', points: ['Games to 11, win by 2', 'Serve changes every two points, every point from 10-10', 'Singles or doubles, with the doubles serving order tracked'] },
            ].map(({ key, Art, title, points }, i) => (
              <div
                key={key}
                className={`lg:col-span-2 ${glass} group relative overflow-hidden p-7 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-400/5`}
              >
                <Art className="absolute right-4 top-4 w-36 h-36 text-white/20 transition duration-500 group-hover:text-emerald-300/60 group-hover:scale-110" />
                <div className="w-12 h-12 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center mb-4"><SportIcon sport={key} className="w-7 h-7" /></div>
                <h3 className="font-display font-bold tracking-wide text-2xl mb-3">{title}</h3>
                <ul className="space-y-1.5 text-sm text-white/65">
                  {points.map((p) => (
                    <li key={p} className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Numbers from real data */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
          <div className={`${glass} grid grid-cols-3 divide-x divide-white/10`}>
            {[
              [tournaments.length || '—', 'Tournaments'],
              [liveCount, 'Live right now'],
              ['6', 'Sports ready'],
            ].map(([v, l]) => (
              <div key={l} className="px-4 py-6 text-center">
                <p className="text-3xl sm:text-5xl font-display font-bold text-emerald-400 sylve-nums">{v}</p>
                <p className="text-xs text-white/50 mt-1">{l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bento features */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
          <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-wide mb-10">Everything a tournament needs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENTO.map((f) => (
              <div
                key={f.title}
                className={`${glass} ${f.span ?? ''} p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-400/5`}
              >
                <div className="w-10 h-10 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center mb-4"><f.Icon className="w-5 h-5" strokeWidth={1.75} /></div>
                <h3 className="font-display font-bold tracking-wide text-lg mb-1">{f.title}</h3>
                <p className="text-white/60 text-sm">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
          <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-wide mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map((st) => (
              <div key={st.n} className="relative pt-12">
                <span className="absolute top-0 left-0 text-6xl font-display font-bold leading-none" style={outline}>{st.n}</span>
                <h3 className="font-display font-bold tracking-wide text-xl mb-1">{st.title}</h3>
                <p className="text-white/60 text-sm">{st.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-emerald-400/5 px-6 py-16 text-center">
            <NetArt className="absolute -left-6 -bottom-4 w-52 h-40 text-emerald-300/10" />
            <HoopArt className="absolute -right-4 -top-2 w-40 h-48 text-emerald-300/10" />
            <h2 className="relative text-3xl sm:text-5xl font-display font-bold tracking-wide mb-3">Ready for the first whistle?</h2>
            <p className="relative text-white/60 mb-7">Set up in minutes. Share one link.</p>
            <Link to={cta} className="relative rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-8 py-3.5 transition inline-block">
              Get started
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
            <span className="font-display font-bold tracking-wide text-emerald-400 text-sm">Sylve</span>
            <span>Live scoring for every game.</span>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/watch" className="hover:text-white/70">Watch live</Link>
              <Link to="/terms" className="hover:text-white/70">Terms</Link>
              <Link to="/privacy" className="hover:text-white/70">Privacy &amp; Cookies</Link>
              <button onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))} className="hover:text-white/70">
                Cookie settings
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

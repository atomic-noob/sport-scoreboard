import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTournaments } from '../lib/adminData'
import { supabase } from '../lib/supabaseClient'
import { Tv, Trophy, BarChart3, Layers, Zap, Check, WifiOff, Medal, Users, ChevronDown, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import SportIcon from '../components/SportIcon'
import { OPEN_COOKIE_SETTINGS } from '../lib/cookieConsent'

// Optional real photos. Leave '' to use the drawn court and net.
// When you add one (e.g. '/photos/basketball.webp' in the public folder), it is shown
// behind the drawing with an emerald tint. Only use photos you have the licence for.
const PHOTOS = { basketball: '', basketball3x3: '', volleyball: '', badminton: '', pickleball: '', tennis: '', tabletennis: '' }

const SPORTS = {
  basketball: {
    label: 'Basketball',
    word: 'Hoops',
    line: 'Fouls, timeouts, quarters and a box score for every player.',
    sample: { a: 'Hawks', b: 'Lions', sa: 68, sb: 64, tag: 'Q4 · 2:41', stats: [['PTS', '24 · 19'], ['REB', '31 · 28'], ['AST', '14 · 11']] },
  },
  basketball3x3: {
    label: '3x3',
    word: 'Streetball',
    line: 'Game clock, 12-second shot clock, team fouls and free throws, first to 21.',
    sample: { a: 'Rim Riders', b: 'Pickups', sa: 15, sb: 13, tag: '6:12 · SHOT 8', stats: [['FOULS', '4 · 5'], ['CLOCK', '6:12'], ['TO WIN', '21, or 10 min']] },
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
  { Icon: WifiOff, title: 'Weak signal? Keep scoring', text: 'Results are kept on the phone and upload by themselves when the connection returns.' },
  { Icon: Medal, title: 'MVP winner board', text: 'Score, quarter or set breakdown and the MVP, with their photo, ready to share.' },
  { Icon: Users, title: 'Singles and pairs', text: 'Add players or pairs directly, no team names, with a live leaderboard.' },
  { Icon: BarChart3, title: 'Leaders & box scores', text: 'Points, rebounds, kills, aces, hitting %. Per tournament.' },
  { Icon: Layers, title: 'One event, every sport', text: 'Group basketball, 3x3, volleyball, badminton, pickleball, tennis and table tennis tournaments under a single link.', span: 'lg:col-span-4' },
]

const FAQ = [
  ['Do I need to install an app or pay?', 'No. Sylve runs in the browser on a phone, tablet or laptop, and it is free while we are in testing.'],
  ['What if the signal drops during a game?', 'Keep scoring. Finished sets and final results are kept on the scorer’s phone and upload automatically when the connection returns. A small notice shows what has not been saved yet.'],
  ['Can people watch without an account?', 'Yes. Share one link and anyone can follow the live score, standings and the MVP on their phone.'],
  ['Which sports does it support?', 'Basketball, 3x3 basketball, volleyball, badminton, pickleball, tennis and table tennis, each with its own rules.'],
  ['Can I run one event with several sports?', 'Yes. An event has one public page that lists every tournament in it, grouped by sport.'],
  ['How do I try it for my league?', 'Open the app and create a tournament, or message us at atomicgladiator324@gmail.com to be a tester.'],
]

const STEPS = [
  { n: '01', title: 'Create', text: 'Set up a tournament or a multi-sport event. Add teams, players or pairs.' },
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

const SPORT_CARDS = [
  { key: 'basketball', Art: HoopArt, title: 'Basketball', points: ['Quarters, fouls and timeouts', 'Winner board with the MVP, quarter by quarter', 'Live court with every substitution'] },
  { key: 'basketball3x3', Art: HoopArt, title: '3x3 Basketball', points: ['10 minutes or first to 21, shots worth 1 or 2', 'Game clock and 12-second shot clock', 'Shooting-foul free throws, and two from the 7th team foul'] },
  { key: 'volleyball', Art: NetArt, title: 'Volleyball', points: ['Sets, rotations and a libero', 'Kills, aces, blocks and hitting %', 'Reopen a set, resume after a refresh'] },
  { key: 'badminton', Art: ShuttleArt, title: 'Badminton', points: ['Rally-point games, singles or doubles', 'Serve court and change of ends tracked for you', 'Live court on the watch page'] },
  { key: 'pickleball', Art: PaddleArt, title: 'Pickleball', points: ['Side-out or rally scoring, and the score call', 'Server 1 and 2 tracked, with the kitchen on court', 'Singles or doubles, best of 1, 3 or 5'] },
  { key: 'tennis', Art: RacketArt, title: 'Tennis', points: ['Games, sets and tiebreaks, deuce or no-ad', 'Serve, court side and change of ends tracked for you', 'Singles or doubles, with an optional match tiebreak'] },
  { key: 'tabletennis', Art: BatArt, title: 'Table Tennis', points: ['Games to 11, win by 2', 'Serve changes every two points, every point from 10-10', 'Singles or doubles, with the doubles serving order tracked'] },
]

/* ---------- Sports carousel ---------- */

function SportsCarousel({ cta }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(null)
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const n = SPORT_CARDS.length

  useEffect(() => {
    if (paused || reduce) return undefined
    const id = setInterval(() => setI((v) => (v + 1) % n), 6000)
    return () => clearInterval(id)
  }, [paused, reduce, i, n])

  const card = SPORT_CARDS[i]
  const sample = SPORTS[card.key].sample
  const go = (d) => setI((v) => (v + d + n) % n)
  const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'

  return (
    <section
      className="max-w-7xl mx-auto px-5 sm:px-8 py-20"
      aria-roledescription="carousel"
      aria-label="Sports on Sylve"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="text-xs font-semibold uppercase text-emerald-400 mb-2">Seven sports. One platform.</p>
      <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-wide mb-8 max-w-3xl">
        Built for the way each game is actually scored
      </h2>

      <div role="tablist" aria-label="Choose a sport" className="flex gap-2 overflow-x-auto pb-3 mb-4 [scrollbar-width:none]">
        {SPORT_CARDS.map((c, idx) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={i === idx}
            onClick={() => setI(idx)}
            className={`relative shrink-0 overflow-hidden rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              i === idx ? 'border-emerald-400/50 bg-emerald-400/10 text-white' : 'border-white/10 text-white/60 hover:text-white hover:border-white/25'
            }`}
          >
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <SportIcon sport={c.key} className="w-5 h-5 text-emerald-300" /> {c.title}
            </span>
            {i === idx && !reduce && (
              <span
                key={`bar-${i}`}
                className="absolute left-0 bottom-0 h-0.5 bg-emerald-400 sylve-progress"
                style={{ animationPlayState: paused ? 'paused' : 'running' }}
              />
            )}
          </button>
        ))}
      </div>

      <div
        key={card.key}
        className={`${glass} sylve-slide relative overflow-hidden p-6 sm:p-10 grid md:grid-cols-[1fr_1fr] gap-8 items-center`}
        role="tabpanel"
        aria-live={paused ? 'polite' : 'off'}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        }}
      >
        <div>
          <div className="flex items-center gap-4 mb-5">
            <span className="w-14 h-14 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
              <SportIcon sport={card.key} className="w-8 h-8" />
            </span>
            <div>
              <h3 className="font-display font-bold tracking-wide text-3xl sm:text-4xl leading-none">{card.title}</h3>
              <p className="text-xs uppercase tracking-widest text-emerald-300/80 mt-1">{SPORTS[card.key].word}</p>
            </div>
          </div>
          <p className="text-white/70 mb-5">{SPORTS[card.key].line}</p>
          <ul className="space-y-2 text-sm text-white/75 mb-7">
            {card.points.map((pt) => (
              <li key={pt} className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{pt}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={cta} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-5 py-2.5 text-sm transition">
              Run a {card.title} tournament
            </Link>
            <Link to="/watch" className="rounded-lg border border-white/20 text-white/80 hover:bg-white/10 font-medium px-5 py-2.5 text-sm transition">
              Watch live
            </Link>
          </div>
        </div>

        <div className="relative aspect-[4/3] rounded-xl border border-white/10 bg-black/40 overflow-hidden">
          <card.Art className="absolute inset-0 m-auto w-3/4 h-3/4 text-emerald-300/50" />
          <div className="absolute left-3 right-3 bottom-3 rounded-xl border border-white/10 bg-black/70 backdrop-blur p-3 text-white">
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              <span className="uppercase font-semibold text-white/40">Sample match</span>
              <span className="flex items-center gap-1.5 text-red-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE · {sample.tag}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sylve-nums">
              <div>
                <p className="text-xs text-white/60">{sample.a}</p>
                <p className="text-3xl font-display font-bold text-emerald-400 leading-none">{sample.sa}</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {sample.stats.map(([k, v]) => (
                  <div key={k} className="rounded bg-white/5 px-1.5 py-1">
                    <p className="text-[8px] text-white/40">{k}</p>
                    <p className="text-[11px] font-medium">{v}</p>
                  </div>
                ))}
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">{sample.b}</p>
                <p className="text-3xl font-display font-bold leading-none">{sample.sb}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {SPORT_CARDS.map((c, idx) => (
            <button
              key={c.key}
              onClick={() => setI(idx)}
              aria-label={`Show ${c.title}`}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-emerald-400' : 'w-2 bg-white/25 hover:bg-white/50'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} aria-label="Previous sport" className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white hover:border-white/40 transition"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => go(1)} aria-label="Next sport" className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white hover:border-white/40 transition"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </section>
  )
}

/* ---------- Real screens on a laptop, a tablet and a phone ---------- */

function DeviceShowcase() {
  const cap = (title, text) => (
    <figcaption className="mt-4 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-white/55 mt-1">{text}</p>
    </figcaption>
  )
  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
      <p className="text-xs font-semibold uppercase text-emerald-400 mb-2">See it in action</p>
      <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-wide mb-10 max-w-3xl">Real screens, on any device</h2>

      <div className="flex gap-8 overflow-x-auto snap-x snap-mandatory pt-3 pb-4 lg:items-end lg:justify-center lg:overflow-visible [scrollbar-width:none]">
        {/* Laptop */}
        <figure className="snap-center shrink-0 w-[88vw] max-w-[620px] group">
          <div className="rounded-t-2xl border-[7px] border-b-0 border-white/15 bg-black overflow-hidden transition group-hover:border-emerald-400/40">
            <img src="/landing/laptop.webp" alt="Tournament page with schedule and standings on a laptop" loading="lazy" className="block w-full aspect-[16/10] object-cover object-top" />
          </div>
          <div className="mx-auto h-3 w-[104%] -ml-[2%] rounded-b-2xl bg-gradient-to-b from-white/25 to-white/10" />
          {cap('Run the whole tournament', 'Schedule and standings first, with the games live right now.')}
        </figure>

        {/* Tablet */}
        <figure className="snap-center shrink-0 w-[62vw] max-w-[290px] group">
          <div className="rounded-[1.6rem] border-[9px] border-white/15 bg-black overflow-hidden shadow-[0_20px_60px_-20px_rgba(16,185,129,0.35)] transition group-hover:border-emerald-400/40">
            <img src="/landing/tablet.webp" alt="Live pickleball score and court on a tablet" loading="lazy" className="block w-full aspect-[820/1000] object-cover object-top" />
          </div>
          {cap('Everyone can watch live', 'The score, who serves, and the court. No account needed.')}
        </figure>

        {/* Phone */}
        <figure className="snap-center shrink-0 w-[52vw] max-w-[220px] group">
          <div className="rounded-[2.2rem] border-[7px] border-white/15 bg-black overflow-hidden shadow-[0_20px_60px_-20px_rgba(16,185,129,0.35)] transition group-hover:border-emerald-400/40">
            <img src="/landing/winner.webp" alt="Winner board with the MVP and quarter scores on a phone" loading="lazy" className="block w-full aspect-[390/844] object-cover object-top" />
          </div>
          {cap('A winner board to share', 'The final score, quarter by quarter, and the MVP with a photo.')}
        </figure>
      </div>
      <p className="mt-4 text-center text-xs text-white/35">Screens show sample data.</p>
    </section>
  )
}

/* ---------- Upcoming calendar ---------- */

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function UpcomingCalendar({ tournaments }) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [sel, setSel] = useState(ymd(today))
  const [games, setGames] = useState([])
  const [filter, setFilter] = useState('all')
  const glass = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur'

  useEffect(() => {
    async function load() {
      const from = new Date()
      from.setHours(0, 0, 0, 0)
      const { data: rows, error } = await supabase
        .from('matches')
        .select('id, tournament_id, team_a_id, team_b_id, scheduled_at, status')
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', from.toISOString())
        .in('status', ['scheduled', 'live'])
        .order('scheduled_at', { ascending: true })
        .limit(40)
      if (error || !rows?.length) return
      const ids = [...new Set(rows.flatMap((r) => [r.team_a_id, r.team_b_id]).filter(Boolean))]
      const { data: teams } = ids.length ? await supabase.from('teams').select('id, name').in('id', ids) : { data: [] }
      const nameOf = new Map((teams ?? []).map((t) => [t.id, t.name]))
      setGames(rows.map((r) => ({ ...r, nameA: nameOf.get(r.team_a_id) ?? 'TBD', nameB: nameOf.get(r.team_b_id) ?? 'TBD' })))
    }
    load().catch((err) => console.warn('Could not load schedule for landing page:', err.message))
  }, [])

  const tById = new Map(tournaments.map((t) => [t.id, t]))
  const byDay = {}
  const add = (key, item) => { (byDay[key] ??= []).push(item) }
  const keep = (t) => filter === 'all' || t?.sport === filter
  tournaments.filter((t) => t.startDate && keep(t)).forEach((t) => add(t.startDate.slice(0, 10), { type: 'start', t }))
  games.filter((g) => keep(tById.get(g.tournament_id))).forEach((g) => add(ymd(new Date(g.scheduled_at)), { type: 'game', g, t: tById.get(g.tournament_id) }))

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, k) => k + 1)]
  const keyOf = (day) => ymd(new Date(month.getFullYear(), month.getMonth(), day))
  const items = byDay[sel] ?? []
  const selDate = new Date(`${sel}T00:00:00`)
  const monthCount = Object.keys(byDay).filter((k) => k.startsWith(ymd(first).slice(0, 7))).length

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
      <p className="text-xs font-semibold uppercase text-emerald-400 mb-2">What is coming up</p>
      <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-wide mb-8 max-w-3xl">See which sports are playing, and when</h2>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 [scrollbar-width:none]" role="group" aria-label="Filter by sport">
        {[{ key: 'all', title: 'All sports' }, ...SPORT_CARDS].map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === c.key ? 'border-emerald-400/50 bg-emerald-400/10 text-white' : 'border-white/10 text-white/60 hover:text-white hover:border-white/25'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {c.key !== 'all' && <SportIcon sport={c.key} className="w-3.5 h-3.5 text-emerald-300" />} {c.title}
            </span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-5">
        <div className={`${glass} p-4 sm:p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold tracking-wide text-xl inline-flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-300" />
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white transition"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white transition"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/40 mb-1">
            {WEEK.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <span key={`b${idx}`} />
              const k = keyOf(day)
              const list = byDay[k] ?? []
              const sports = [...new Set(list.map((x) => x.t?.sport).filter(Boolean))].slice(0, 3)
              const isToday = k === ymd(today)
              return (
                <button
                  key={k}
                  onClick={() => setSel(k)}
                  aria-label={`${k}, ${list.length} scheduled`}
                  className={`aspect-square rounded-lg border text-sm flex flex-col items-center justify-center gap-0.5 transition ${
                    sel === k ? 'border-emerald-400 bg-emerald-400/15 text-white' : isToday ? 'border-emerald-400/40 text-white' : 'border-white/5 text-white/70 hover:border-white/25'
                  }`}
                >
                  <span className="sylve-nums">{day}</span>
                  <span className="flex h-3.5 items-center gap-0.5 text-emerald-300">
                    {sports.map((sp) => <SportIcon key={sp} sport={sp} className="w-3 h-3" />)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className={`${glass} p-5 sm:p-6`}>
          <h3 className="font-display font-bold tracking-wide text-xl mb-1">
            {selDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <p className="text-xs text-white/40 mb-4">{items.length === 0 ? 'Nothing scheduled' : `${items.length} scheduled`}</p>
          {items.length === 0 ? (
            <p className="text-sm text-white/55">
              {monthCount === 0
                ? 'No games are scheduled this month yet. Organizers: add a start date to your tournament, or a time to a match, and it shows up here.'
                : 'Pick another day, or use the arrows to see other months.'}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <Link
                  key={idx}
                  to={it.type === 'game' ? `/watch/${it.g.tournament_id}/match/${it.g.id}` : `/watch/${it.t.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 hover:border-emerald-400/40 transition"
                >
                  <SportIcon sport={it.t?.sport} className="w-5 h-5 text-emerald-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {it.type === 'game' ? `${it.g.nameA} vs ${it.g.nameB}` : `${it.t.name} starts`}
                    </p>
                    <p className="text-xs text-white/45 truncate">
                      {it.type === 'game'
                        ? `${new Date(it.g.scheduled_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${it.t?.name ?? 'Match'}`
                        : 'Tournament'}
                    </p>
                  </div>
                  {it.type === 'game' && it.g.status === 'live' && <span className="text-[10px] font-semibold text-red-400">LIVE</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
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
        @keyframes sylve-slide { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
        @keyframes sylve-progress { from { width: 0 } to { width: 100% } }
        .sylve-slide { animation: sylve-slide .45s ease both; }
        .sylve-progress { animation: sylve-progress 6s linear both; }
        @media (prefers-reduced-motion: reduce) { .sylve-slide, .sylve-progress { animation: none } }
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
              <p className="mt-5 text-xs text-white/50">Free while we are in testing &nbsp;·&nbsp; No install &nbsp;·&nbsp; Works on a weak signal</p>
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
                <div className="absolute inset-0 p-3">{(sport === 'basketball' || sport === 'basketball3x3') ? <BasketballArt /> : sport === 'volleyball' ? <VolleyballArt /> : sport === 'badminton' ? <BadmintonArt /> : sport === 'tennis' ? <TennisArt /> : sport === 'tabletennis' ? <TableArt /> : <PickleballArt />}</div>

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

        <SportsCarousel cta={cta} />

        <DeviceShowcase />

        <UpcomingCalendar tournaments={tournaments} />

        {/* Numbers from real data */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
          <div className={`${glass} grid grid-cols-3 divide-x divide-white/10`}>
            {[
              [tournaments.length || '—', 'Tournaments'],
              [liveCount, 'Live right now'],
              ['7', 'Sports ready'],
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

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-5 sm:px-8 pb-20">
          <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-wide mb-8">Questions people ask</h2>
          <div className="space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className={`${glass} group px-5 py-4`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <ChevronDown className="w-4 h-4 shrink-0 text-emerald-300 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-white/65">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-emerald-400/5 px-6 py-16 text-center">
            <NetArt className="absolute -left-6 -bottom-4 w-52 h-40 text-emerald-300/10" />
            <HoopArt className="absolute -right-4 -top-2 w-40 h-48 text-emerald-300/10" />
            <h2 className="relative text-3xl sm:text-5xl font-display font-bold tracking-wide mb-3">Ready for the first whistle?</h2>
            <p className="relative text-white/60 mb-2">Set up in minutes. Share one link.</p>
            <p className="relative text-white/40 text-sm mb-7">Free while we are in testing. Want to be a tester? <a href="mailto:atomicgladiator324@gmail.com" className="text-emerald-300 hover:text-emerald-200 underline">atomicgladiator324@gmail.com</a></p>
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

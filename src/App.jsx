import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import SyncStatusBadge from './components/SyncStatusBadge'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { signOut } from './lib/auth'
import TournamentHome from './features/tournament/TournamentHome'
import NewTournament from './features/tournament/NewTournament'
import TournamentAdmin from './features/tournament/TournamentAdmin'
import TeamRoster from './features/tournament/TeamRoster'
import EditTournament from './features/tournament/EditTournament'
import TournamentFormat from './features/tournament/TournamentFormat'
import TournamentSchedule from './features/tournament/TournamentSchedule'
import MatchSimulate from './features/basketball/MatchSimulate'
import LineupSetup from './features/basketball/LineupSetup'
import WatchHome from './features/watch/WatchHome'
import WatchTournament from './features/watch/WatchTournament'
import WatchMatch from './features/watch/WatchMatch'
import ShareRedirect from './features/watch/ShareRedirect'
import ManualBracketBuilder from './features/tournament/ManualBracketBuilder'
import EventsHome from './features/event/EventsHome'
import EventAdmin from './features/event/EventAdmin'
import WatchEvent from './features/watch/WatchEvent'
import TournamentLeaderboard from './features/tournament/TournamentLeaderboard'
import VolleyballMatchSimulate from './features/volleyball/VolleyballMatchSimulate'
import VolleyballLineupSetup from './features/volleyball/VolleyballLineupSetup'

function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // /watch and /live pages are the public spectator experience and have
  // their own self-contained header -- skip the organizer-facing app
  // header there so it doesn't double up.
  if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/live')) return null

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="border-b border-line bg-panel">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="font-bold text-ink">
          🏆 Scoreboard
        </Link>
        <div className="flex items-center gap-4">
          <SyncStatusBadge />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-faint hidden sm:inline">{user.email}</span>
              <button onClick={handleSignOut} className="text-xs font-medium text-ink-dim hover:text-ink">
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login" className="text-xs font-medium text-accent hover:text-accent-strong">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

// Picks the right live-scoring engine for the sport. Each sport's rules
// are different enough (basketball's quarters/fouls vs volleyball's
// sets/rotation) that these stay as separate components rather than one
// component branching internally on every line.
function SportMatchSimulate() {
  const { sport } = useParams()
  if (sport === 'volleyball') return <VolleyballMatchSimulate />
  return <MatchSimulate />
}

function SportLineupSetup() {
  const { sport } = useParams()
  if (sport === 'volleyball') return <VolleyballLineupSetup />
  return <LineupSetup />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-page">
          <AppHeader />

          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />

            {/* Organizer/scorer routes -- require an account. :sport is
                the sport slug (basketball, volleyball, ...) -- these
                shared components are sport-agnostic (rosters, standings,
                brackets, leaderboards don't care what sport it is). */}
            {/* Events group tournaments of any sport. These static paths
                outrank the dynamic /:sport routes below. */}
            <Route path="/events" element={<ProtectedRoute><EventsHome /></ProtectedRoute>} />
            <Route path="/events/:eventId" element={<ProtectedRoute><EventAdmin /></ProtectedRoute>} />

            <Route path="/:sport" element={<ProtectedRoute><TournamentHome /></ProtectedRoute>} />
            <Route path="/:sport/new" element={<ProtectedRoute><NewTournament /></ProtectedRoute>} />
            <Route path="/:sport/leaderboard" element={<ProtectedRoute><TournamentLeaderboard /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId" element={<ProtectedRoute><TournamentAdmin /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId/edit" element={<ProtectedRoute><EditTournament /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId/format" element={<ProtectedRoute><TournamentFormat /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId/schedule" element={<ProtectedRoute><TournamentSchedule /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId/leaderboard" element={<ProtectedRoute><TournamentLeaderboard /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId/match/:matchId/lineup" element={<ProtectedRoute><SportLineupSetup /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId/match/:matchId" element={<ProtectedRoute><SportMatchSimulate /></ProtectedRoute>} />
            <Route path="/:sport/:tournamentId/team/:teamId" element={<ProtectedRoute><TeamRoster /></ProtectedRoute>} />

            <Route path="/:sport/:tournamentId/bracket-builder" element={<ProtectedRoute><ManualBracketBuilder /></ProtectedRoute>} />

            {/* Public spectator routes -- no login, opened in a new tab.
                Sport-agnostic: browses/watches across every sport. */}
            <Route path="/watch" element={<WatchHome />} />
            <Route path="/watch/events/:eventId" element={<WatchEvent />} />
            <Route path="/watch/:tournamentId" element={<WatchTournament />} />
            <Route path="/watch/:tournamentId/match/:matchId" element={<WatchMatch />} />
            <Route path="/live/:code" element={<ShareRedirect />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

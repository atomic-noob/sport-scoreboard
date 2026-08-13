import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import SyncStatusBadge from './components/SyncStatusBadge'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { signOut } from './lib/auth'
import BasketballHome from './features/basketball/BasketballHome'
import NewTournament from './features/basketball/NewTournament'
import TournamentAdmin from './features/basketball/TournamentAdmin'
import TeamRoster from './features/basketball/TeamRoster'
import EditTournament from './features/basketball/EditTournament'
import TournamentFormat from './features/basketball/TournamentFormat'
import TournamentSchedule from './features/basketball/TournamentSchedule'
import MatchSimulate from './features/basketball/MatchSimulate'
import LineupSetup from './features/basketball/LineupSetup'
import WatchHome from './features/basketball/WatchHome'
import WatchTournament from './features/basketball/WatchTournament'
import WatchMatch from './features/basketball/WatchMatch'
import TournamentLeaderboard from './features/basketball/TournamentLeaderboard'

function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // /watch pages are the public spectator experience and have their own
  // self-contained header (tournament name, live badge) -- skip the
  // organizer-facing app header there so it doesn't double up.
  if (location.pathname.startsWith('/watch')) return null

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="border-b border-line bg-panel">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-ink">
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-page">
          <AppHeader />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            {/* Organizer/scorer routes -- require an account */}
            <Route path="/basketball" element={<ProtectedRoute><BasketballHome /></ProtectedRoute>} />
            <Route path="/basketball/new" element={<ProtectedRoute><NewTournament /></ProtectedRoute>} />
            <Route path="/basketball/leaderboard" element={<ProtectedRoute><TournamentLeaderboard /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId" element={<ProtectedRoute><TournamentAdmin /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId/edit" element={<ProtectedRoute><EditTournament /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId/format" element={<ProtectedRoute><TournamentFormat /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId/schedule" element={<ProtectedRoute><TournamentSchedule /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId/leaderboard" element={<ProtectedRoute><TournamentLeaderboard /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId/match/:matchId/lineup" element={<ProtectedRoute><LineupSetup /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId/match/:matchId" element={<ProtectedRoute><MatchSimulate /></ProtectedRoute>} />
            <Route path="/basketball/:tournamentId/team/:teamId" element={<ProtectedRoute><TeamRoster /></ProtectedRoute>} />

            {/* Public spectator routes -- no login, opened in a new tab */}
            <Route path="/watch" element={<WatchHome />} />
            <Route path="/watch/:tournamentId" element={<WatchTournament />} />
            <Route path="/watch/:tournamentId/match/:matchId" element={<WatchMatch />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

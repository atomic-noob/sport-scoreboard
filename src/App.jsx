import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import SyncStatusBadge from './components/SyncStatusBadge'
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

function AppHeader() {
  const location = useLocation()
  // /watch pages are the public spectator experience and have their own
  // self-contained header (tournament name, live badge) -- skip the
  // organizer-facing app header there so it doesn't double up.
  if (location.pathname.startsWith('/watch')) return null

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-slate-900">
          🏆 Scoreboard
        </Link>
        <SyncStatusBadge />
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <AppHeader />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/basketball" element={<BasketballHome />} />
          <Route path="/basketball/new" element={<NewTournament />} />
          <Route path="/basketball/:tournamentId" element={<TournamentAdmin />} />
          <Route path="/basketball/:tournamentId/edit" element={<EditTournament />} />
          <Route path="/basketball/:tournamentId/format" element={<TournamentFormat />} />
          <Route path="/basketball/:tournamentId/schedule" element={<TournamentSchedule />} />
          <Route path="/basketball/:tournamentId/match/:matchId/lineup" element={<LineupSetup />} />
          <Route path="/basketball/:tournamentId/match/:matchId" element={<MatchSimulate />} />
          <Route path="/basketball/:tournamentId/team/:teamId" element={<TeamRoster />} />

          {/* Public spectator routes -- no login, opened in a new tab */}
          <Route path="/watch" element={<WatchHome />} />
          <Route path="/watch/:tournamentId" element={<WatchTournament />} />
          <Route path="/watch/:tournamentId/match/:matchId" element={<WatchMatch />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

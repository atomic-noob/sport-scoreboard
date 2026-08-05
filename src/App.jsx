import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import SyncStatusBadge from './components/SyncStatusBadge'
import BasketballHome from './features/basketball/BasketballHome'
import NewTournament from './features/basketball/NewTournament'
import TournamentAdmin from './features/basketball/TournamentAdmin'
import TeamRoster from './features/basketball/TeamRoster'
import EditTournament from './features/basketball/EditTournament'
import TournamentFormat from './features/basketball/TournamentFormat'
import TournamentSchedule from './features/basketball/TournamentSchedule'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="font-bold text-slate-900">
              🏆 Scoreboard
            </Link>
            <SyncStatusBadge />
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/basketball" element={<BasketballHome />} />
          <Route path="/basketball/new" element={<NewTournament />} />
          <Route path="/basketball/:tournamentId" element={<TournamentAdmin />} />
          <Route path="/basketball/:tournamentId/edit" element={<EditTournament />} />
          <Route path="/basketball/:tournamentId/format" element={<TournamentFormat />} />
          <Route path="/basketball/:tournamentId/schedule" element={<TournamentSchedule />} />
          <Route path="/basketball/:tournamentId/team/:teamId" element={<TeamRoster />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

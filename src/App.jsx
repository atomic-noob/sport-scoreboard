import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import SyncStatusBadge from './components/SyncStatusBadge'

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
        </Routes>
      </div>
    </BrowserRouter>
  )
}

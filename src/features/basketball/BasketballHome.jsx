import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTournaments } from '../../lib/adminData'

export default function BasketballHome() {
  const [tournaments, setTournaments] = useState([])

  useEffect(() => {
    getTournaments().then(setTournaments)
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">🏀 Basketball</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/basketball/leaderboard"
            className="text-sm font-medium text-slate-400 hover:text-orange-500"
          >
            🏆 Global Leaderboard
          </Link>
          <Link
            to="/basketball/new"
            className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 transition"
          >
            + New Tournament
          </Link>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center text-slate-400 py-16 border border-dashed border-slate-200 rounded-xl">
          No tournaments yet. Create your first one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-orange-400 hover:shadow-sm transition"
            >
              <Link to={`/basketball/${t.id}`} className="flex-1">
                <div className="font-medium text-slate-800">{t.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {t.rules.quarterMinutes}min quarters · foul-out at {t.rules.foulLimit}
                  {t.startDate && <> · starts {t.startDate}</>}
                  {t.pin && <> · 🔒 PIN protected</>}
                </div>
              </Link>
              <Link
                to={`/basketball/${t.id}/edit`}
                className="text-xs font-medium text-slate-400 hover:text-orange-500 px-2 py-1"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

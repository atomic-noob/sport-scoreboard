import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getTournament } from '../../lib/adminData'
import BasketballWatchMatch from '../basketball/BasketballWatchMatch'
import VolleyballWatchMatch from '../volleyball/VolleyballWatchMatch'

/**
 * Public live/final view of one game. Each sport has its own view (the
 * scores, clock and box score look different); this just picks the right
 * one. To add a sport, build its watch view and add a line here.
 */
const WATCH_VIEWS = {
  basketball: BasketballWatchMatch,
  volleyball: VolleyballWatchMatch,
}

export default function WatchMatch() {
  const { tournamentId } = useParams()
  const [sport, setSport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getTournament(tournamentId)
      .then((t) => setSport(t.sport))
      .catch((err) => {
        console.error('Failed to load tournament:', err)
        setError('Could not load this match. Check your connection and try refreshing.')
      })
  }, [tournamentId])

  if (!sport) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        {error ? (
          <div className="rounded-lg border border-live bg-live-soft px-3 py-2 text-sm text-live">{error}</div>
        ) : (
          <p className="text-ink-faint">Loading...</p>
        )}
      </div>
    )
  }

  const View = WATCH_VIEWS[sport] ?? BasketballWatchMatch
  return <View />
}

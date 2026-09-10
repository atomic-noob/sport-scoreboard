import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { getMatchByShareCode } from '../../lib/matchesData'

export default function ShareRedirect() {
  const { code } = useParams()
  const [target, setTarget] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getMatchByShareCode(code)
      .then((match) => {
        if (match) {
          setTarget(`/watch/${match.tournamentId}/match/${match.id}`)
        } else {
          setNotFound(true)
        }
      })
      .catch((err) => {
        console.error('Failed to resolve share code:', err)
        setNotFound(true)
      })
  }, [code])

  if (target) return <Navigate to={target} replace />

  if (notFound) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-ink font-medium mb-1">Link not found</p>
          <p className="text-ink-dim text-sm">This game link doesn't exist or hasn't started yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <p className="text-ink-faint">Loading...</p>
    </div>
  )
}

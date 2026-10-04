import { useState } from 'react'

/** Copy / QR / social share box for a live game. Used by every sport's watch page. */
export default function ShareSection({ match }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const shareUrl = match.shareCode
    ? `${window.location.origin}/live/${match.shareCode}`
    : window.location.href

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail on some browsers/contexts -- not critical, user can select the text manually.
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Live game', url: shareUrl })
      } catch {
        // User cancelled the share sheet -- nothing to do.
      }
    } else {
      setExpanded(true)
    }
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`
  const messengerUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=0&redirect_uri=${encodeURIComponent(shareUrl)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`

  return (
    <div className="rounded-xl border border-line bg-panel p-4 mb-4">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-sm font-medium text-ink"
      >
        <span>📤 Share this live game</span>
        <span className="text-ink-faint text-xs">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col sm:flex-row gap-4 items-center">
          <img src={qrSrc} alt="QR code to this live game" width={140} height={140} className="rounded-lg border border-line shrink-0" />
          <div className="flex-1 w-full space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                onClick={(e) => e.target.select()}
                className="flex-1 min-w-0 rounded-lg border border-line-strong bg-panel-alt px-3 py-2 text-xs text-ink-dim"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-accent hover:bg-accent-strong text-on-accent text-xs font-medium px-3 py-2 transition"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs font-medium py-2 transition"
              >
                Share...
              </button>
              <a
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs font-medium py-2 transition"
              >
                Messenger
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center rounded-lg border border-line-strong text-ink-dim hover:bg-panel-alt text-xs font-medium py-2 transition"
              >
                Facebook
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { TEAM_CLASS } from '../../lib/teamColors'
import { whoIsWho } from '../../lib/tableTennisRules'

/**
 * Top-down table (ITTF: 2.74 m x 1.525 m) with the net across the middle and a
 * centre line along the length. Team A stands at the left end, team B at the
 * right; `flipped` swaps the ends because players change ends between games.
 * The server wears a filled "S" badge and the receiver an "R" ring, and they
 * move after every service change.
 * Used by the scoring screen and the public watch page (view only).
 */
const VB_W = 300
const VB_H = 170
const TX1 = 56
const TX2 = 244
const TY1 = 34
const TY2 = 136
const MID_X = (TX1 + TX2) / 2
const MID_Y = (TY1 + TY2) / 2

function initials(name) {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default function TableTennisCourt({ state, playersA, playersB, flipped = false, perSide = 1 }) {
  const who = state ? whoIsWho(state) : null
  const chips = []
  const endX = (side) => ((side === 'A') !== flipped ? 24 : VB_W - 24)
  const place = (side, players) => {
    players.slice(0, perSide).forEach((player, idx) => {
      const y = perSide === 1 ? MID_Y : idx === 0 ? MID_Y - 30 : MID_Y + 30
      const isServer = who && who.server.side === side && who.server.idx === idx
      const isReceiver = who && who.receiver.side === side && who.receiver.idx === idx
      chips.push({ key: `${side}${idx}`, side, x: endX(side), y, name: player.name, isServer, isReceiver })
    })
  }
  if (playersA?.length) place('A', playersA)
  if (playersB?.length) place('B', playersB)

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 w-full h-full rounded-lg" role="img" aria-label="Table tennis table">
      <rect x="0" y="0" width={VB_W} height={VB_H} className="fill-panel" />
      <rect x={TX1} y={TY1} width={TX2 - TX1} height={TY2 - TY1} rx="2" className="fill-panel-alt" />
      <rect
        x={flipped ? MID_X : TX1}
        y={TY1}
        width={MID_X - TX1}
        height={TY2 - TY1}
        className={TEAM_CLASS.A.fill}
        fillOpacity="0.12"
      />
      <rect
        x={flipped ? TX1 : MID_X}
        y={TY1}
        width={TX2 - MID_X}
        height={TY2 - TY1}
        className={TEAM_CLASS.B.fill}
        fillOpacity="0.12"
      />
      <rect x={TX1} y={TY1} width={TX2 - TX1} height={TY2 - TY1} rx="2" fill="none" className="stroke-ink-dim" strokeWidth="1.4" />
      <line x1={TX1} y1={MID_Y} x2={TX2} y2={MID_Y} className="stroke-ink-dim" strokeWidth="0.7" strokeDasharray="3 3" />
      <line x1={MID_X} y1={TY1 - 10} x2={MID_X} y2={TY2 + 10} className="stroke-ink" strokeWidth="2.4" />
      <circle cx={MID_X} cy={TY1 - 10} r="2.6" className="fill-ink" />
      <circle cx={MID_X} cy={TY2 + 10} r="2.6" className="fill-ink" />

      {chips.map((c) => (
        <g key={c.key} style={{ transition: 'all 0.3s' }}>
          <circle
            cx={c.x}
            cy={c.y}
            r="14"
            className={`fill-page ${c.side === 'A' ? 'stroke-accent' : 'stroke-live'}`}
            strokeWidth={c.isServer || c.isReceiver ? 3 : 1.6}
          />
          <text x={c.x} y={c.y + 3.5} textAnchor="middle" className="fill-ink" style={{ fontSize: 9, fontWeight: 700 }}>
            {initials(c.name)}
          </text>
          {(c.isServer || c.isReceiver) && (
            <g>
              <circle cx={c.x + (c.x < MID_X ? 12 : -12)} cy={c.y - 12} r="6.5" className={c.isServer ? 'fill-accent' : 'fill-panel-alt stroke-ink-dim'} strokeWidth="1" />
              <text
                x={c.x + (c.x < MID_X ? 12 : -12)}
                y={c.y - 9.6}
                textAnchor="middle"
                className={c.isServer ? 'fill-on-accent' : 'fill-ink'}
                style={{ fontSize: 8, fontWeight: 800 }}
              >
                {c.isServer ? 'S' : 'R'}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  )
}

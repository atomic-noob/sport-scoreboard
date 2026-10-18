import { TEAM_CLASS } from '../../lib/teamColors'
import { currentServer, serveCourt, serverIdx, receiverIdx } from '../../lib/tennisRules'

/**
 * Top-down tennis court in real proportions (ITF): 78 ft long and 36 ft wide
 * for doubles (27 ft for singles), net across the middle, service lines 21 ft
 * from the net and a centre service line splitting the two service boxes.
 * Logical units are feet: u runs along the length (0..88, net at 44, with a
 * 5 ft margin), v across the width (0..46). In portrait the picture is turned
 * 90 degrees so it fills a tall phone screen. Team A starts on the left / top;
 * `flipped` swaps the ends (teams change ends during the match).
 *
 * The server stands behind the baseline on the side the rules give them (right
 * when an even number of points has been played in the game, left when odd);
 * the receiver waits diagonally across. In doubles the server's partner and
 * the receiver's partner wait near the net.
 * Used by the scoring screen and the public watch page (view only).
 */
const L = 88
const W = 46
const NET = L / 2
const CX = W / 2
const HALF = 18 // half the doubles width
const SINGLES = 13.5 // half the singles width
const SERVICE = 21 // service line distance from the net

export default function TennisCourt({ portrait, match, playersA, playersB, flipped = false, matchType = 'singles' }) {
  const perSide = matchType === 'doubles' ? 2 : 1

  const toScreen = (u, v) => {
    const uu = flipped ? L - u : u
    const vv = flipped ? W - v : v
    return portrait ? { x: (W - vv) / W, y: uu / L } : { x: uu / L, y: vv / W }
  }

  // v of a side's right / left half (a side's "right" depends on which way it faces).
  const courtV = (side, court, off) => {
    // Team A faces +u: its right hand points to +v. Team B faces -u: right is -v.
    const sign = (side === 'A') === (court === 'right') ? 1 : -1
    return CX + sign * off
  }

  const chips = []
  if (match && playersA?.length >= perSide && playersB?.length >= perSide) {
    const server = currentServer(match)
    const receiver = server === 'A' ? 'B' : 'A'
    const court = serveCourt(match)
    const other = court === 'right' ? 'left' : 'right'
    const sIdx = serverIdx(match, perSide)
    const rIdx = receiverIdx(match, perSide)
    const place = (side, players) => {
      players.slice(0, perSide).forEach((player, idx) => {
        let dist
        let v
        let isServer = false
        if (side === server && idx === sIdx) {
          dist = 39.5
          v = courtV(side, court, 4)
          isServer = true
        } else if (side === receiver && idx === rIdx) {
          dist = perSide === 1 ? 36 : SERVICE + 3
          v = courtV(side, court, 7)
        } else {
          // The partners wait near the net, on the other half.
          dist = 7
          v = courtV(side, other, 7)
        }
        const u = side === 'A' ? NET - dist : NET + dist
        const { x, y } = toScreen(u, v)
        chips.push({ key: `${side}${idx}`, side, player, x, y, isServer })
      })
    }
    place('A', playersA)
    place('B', playersB)
  }

  const chipW = portrait ? 7 / W : 7 / L
  const chipH = portrait ? 7 / L : 7 / W
  const ratio = portrait ? W / L : L / W
  const initials = (name) =>
    (name ?? '?').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  const left = 5
  const right = L - 5
  const top = (W - 2 * HALF) / 2
  const bottom = top + 2 * HALF
  const sTop = CX - SINGLES
  const sBottom = CX + SINGLES

  return (
    <div className="absolute inset-0" style={{ containerType: 'size' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(100cqw, calc(100cqh * ${ratio}))`,
          aspectRatio: `${portrait ? W : L} / ${portrait ? L : W}`,
          containerType: 'inline-size',
        }}
      >
        <svg
          viewBox={portrait ? `0 0 ${W} ${L}` : `0 0 ${L} ${W}`}
          className="absolute inset-0 w-full h-full rounded-lg"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g transform={portrait ? `translate(${W} 0) rotate(90)` : undefined}>
            <rect x="0" y="0" width={L} height={W} className="fill-panel" />
            <rect x={left} y={top} width={right - left} height={bottom - top} className="fill-panel-alt" />
            <rect x={left} y={top} width={NET - left} height={bottom - top} className={TEAM_CLASS.A.fill} fillOpacity="0.12" />
            <rect x={NET} y={top} width={right - NET} height={bottom - top} className={TEAM_CLASS.B.fill} fillOpacity="0.12" />
            {/* outer (doubles) lines */}
            <rect x={left} y={top} width={right - left} height={bottom - top} fill="none" className="stroke-ink-dim" strokeWidth="0.3" />
            {/* singles sidelines */}
            <line x1={left} y1={sTop} x2={right} y2={sTop} className="stroke-ink-dim" strokeWidth="0.25" />
            <line x1={left} y1={sBottom} x2={right} y2={sBottom} className="stroke-ink-dim" strokeWidth="0.25" />
            {/* service lines */}
            <line x1={NET - SERVICE} y1={sTop} x2={NET - SERVICE} y2={sBottom} className="stroke-ink-dim" strokeWidth="0.25" />
            <line x1={NET + SERVICE} y1={sTop} x2={NET + SERVICE} y2={sBottom} className="stroke-ink-dim" strokeWidth="0.25" />
            {/* centre service line */}
            <line x1={NET - SERVICE} y1={CX} x2={NET + SERVICE} y2={CX} className="stroke-ink-dim" strokeWidth="0.25" />
            {/* centre marks on the baselines */}
            <line x1={left} y1={CX} x2={left + 1.6} y2={CX} className="stroke-ink-dim" strokeWidth="0.25" />
            <line x1={right} y1={CX} x2={right - 1.6} y2={CX} className="stroke-ink-dim" strokeWidth="0.25" />
            {/* net */}
            <line x1={NET} y1={top - 2} x2={NET} y2={bottom + 2} className="stroke-ink" strokeWidth="0.6" />
            <circle cx={NET} cy={top - 2} r="0.7" className="fill-ink" />
            <circle cx={NET} cy={bottom + 2} r="0.7" className="fill-ink" />
          </g>
        </svg>
        {chips.map((c) => (
          <div
            key={c.key}
            title={c.player.name}
            className={`absolute flex flex-col items-center justify-center rounded-full leading-none border-2 bg-page text-ink ${TEAM_CLASS[c.side].border} ${
              c.isServer ? 'ring-2 ring-ink' : ''
            }`}
            style={{
              left: `${c.x * 100}%`,
              top: `${c.y * 100}%`,
              width: `${chipW * 100}%`,
              height: `${chipH * 100}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left .45s ease, top .45s ease',
            }}
          >
            <span style={{ fontSize: portrait ? 'max(11px, 5cqw)' : 'max(11px, 3cqw)', fontWeight: 700 }}>
              {c.player.jerseyNumber ? `#${c.player.jerseyNumber}` : initials(c.player.name)}
            </span>
            <span
              style={{
                fontSize: portrait ? 'max(8px, 3cqw)' : 'max(8px, 1.8cqw)',
                maxWidth: '90%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}
            >
              {c.player.name}
            </span>
            {c.isServer && (
              <span className="absolute -top-1 -right-1 bg-ink text-page rounded-full" style={{ fontSize: 8, padding: '1px 4px' }}>
                S
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

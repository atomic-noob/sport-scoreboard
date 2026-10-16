import { TEAM_CLASS } from '../../lib/teamColors'
import { whoIsWho } from '../../lib/pickleballRules'

/**
 * Top-down pickleball court in real proportions (USA Pickleball): 20 ft wide
 * and 44 ft long, net across the middle, a 7 ft non-volley zone ("kitchen") on
 * each side of the net, and a centre line splitting the two service courts
 * behind it. Logical units are feet: u runs along the length (0..52, net at
 * 26, with a 4 ft margin), v across the width (0..28). In portrait the
 * picture is turned 90 degrees so it fills a tall phone screen. Team A starts
 * on the left / top; `flipped` swaps the ends (teams change ends between games).
 *
 * The server stands in the service court the rules give them (right when their
 * score is even in singles; right after a side-out and alternating after each
 * point in doubles); the receiver stands diagonally across; in doubles each
 * partner waits near the kitchen line.
 * Used by the scoring screen and the public watch page (view only).
 */
const L = 52
const W = 28
const NET = L / 2
const CX = W / 2
const COURT_HALF = 10 // half the court width
const KITCHEN = 7

export default function PickleballCourt({ portrait, state, playersA, playersB, flipped = false, matchType = 'doubles' }) {
  const perSide = matchType === 'singles' ? 1 : 2

  const toScreen = (u, v) => {
    const uu = flipped ? L - u : u
    const vv = flipped ? W - v : v
    return portrait ? { x: (W - vv) / W, y: uu / L } : { x: uu / L, y: vv / W }
  }

  // v of a side's right / left service court centre (a side's "right" depends on which way it faces).
  const courtV = (side, court) => {
    // Team A faces +u: its right hand points to +v. Team B faces -u: right is -v.
    const sign = (side === 'A') === (court === 'right') ? 1 : -1
    return CX + sign * (COURT_HALF / 2)
  }

  const chips = []
  if (state && playersA?.length >= perSide && playersB?.length >= perSide) {
    const who = whoIsWho(state, perSide)
    const place = (side, players) => {
      const rightIdx = side === 'A' ? state.rightA : state.rightB
      players.slice(0, perSide).forEach((player, idx) => {
        const court = perSide === 1 ? who[state.serving === side ? 'server' : 'receiver'].court : idx === rightIdx ? 'right' : 'left'
        const isServer = who.server.side === side && who.server.playerIdx === idx
        const isReceiver = who.receiver.side === side && who.receiver.playerIdx === idx
        const dist = isServer ? 19.5 : isReceiver ? 18 : KITCHEN + 2.5 // partners wait just outside the kitchen
        const u = side === 'A' ? NET - dist : NET + dist
        const { x, y } = toScreen(u, courtV(side, court))
        chips.push({ key: `${side}${idx}`, side, player, x, y, isServer })
      })
    }
    place('A', playersA)
    place('B', playersB)
  }

  const chipW = portrait ? 6.5 / W : 6.5 / L
  const chipH = portrait ? 6.5 / L : 6.5 / W
  const ratio = portrait ? W / L : L / W
  const initials = (name) =>
    (name ?? '?').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  const left = 4
  const right = L - 4
  const top = 4
  const bottom = W - 4

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
            {/* non-volley zones (kitchens) */}
            <rect x={NET - KITCHEN} y={top} width={KITCHEN} height={bottom - top} className="fill-ink" fillOpacity="0.07" />
            <rect x={NET} y={top} width={KITCHEN} height={bottom - top} className="fill-ink" fillOpacity="0.07" />
            <rect x={left} y={top} width={right - left} height={bottom - top} fill="none" className="stroke-ink-dim" strokeWidth="0.3" />
            {/* kitchen lines */}
            <line x1={NET - KITCHEN} y1={top} x2={NET - KITCHEN} y2={bottom} className="stroke-ink-dim" strokeWidth="0.25" />
            <line x1={NET + KITCHEN} y1={top} x2={NET + KITCHEN} y2={bottom} className="stroke-ink-dim" strokeWidth="0.25" />
            {/* centre lines, from the kitchen line to the baseline */}
            <line x1={left} y1={CX} x2={NET - KITCHEN} y2={CX} className="stroke-ink-dim" strokeWidth="0.25" />
            <line x1={NET + KITCHEN} y1={CX} x2={right} y2={CX} className="stroke-ink-dim" strokeWidth="0.25" />
            {/* net */}
            <line x1={NET} y1="2" x2={NET} y2={W - 2} className="stroke-ink" strokeWidth="0.6" />
            <circle cx={NET} cy="2" r="0.6" className="fill-ink" />
            <circle cx={NET} cy={W - 2} r="0.6" className="fill-ink" />
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

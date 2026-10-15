import { TEAM_CLASS } from '../../lib/teamColors'
import { whoIsWho } from '../../lib/badmintonRules'

/**
 * Top-down badminton court drawn in real proportions (BWF): 13.40 m long,
 * 6.10 m wide for doubles (5.18 m for singles), net across the middle, short
 * service line 1.98 m from the net, doubles long service line 0.76 m inside the
 * back line, and a centre line splitting the two service courts on each side.
 *
 * Logical coordinates: u runs along the length (0..15.4, net at 7.7), v across
 * the width (0..8.1) -- including a 1 m margin. In portrait the picture is
 * turned 90 degrees so it fills a tall phone screen. Team A starts on the
 * left / top. `flipped` swaps the ends (players change ends between games).
 *
 * Each player stands where the rules put them: the server in the right
 * service court when their score is even and the left when it is odd, the
 * receiver diagonally opposite, and (in doubles) the partners in the other
 * court. Chips slide to their new spot after every rally.
 * Used by the scoring screen and the public watch page (view only).
 */
const L = 15.4
const W = 8.1
const NET = L / 2
const CX = W / 2
const HALF_DOUBLES = 3.05
const HALF_SINGLES = 2.59

export default function BadmintonCourt({ portrait, state, playersA, playersB, flipped = false, matchType = 'singles' }) {
  const perSide = matchType === 'doubles' ? 2 : 1
  const half = perSide === 2 ? HALF_DOUBLES : HALF_SINGLES
  const courtCenter = half / 2 // centre of one service court from the centre line

  const toScreen = (u, v) => {
    const uu = flipped ? L - u : u
    const vv = flipped ? W - v : v
    return portrait ? { x: (W - vv) / W, y: uu / L } : { x: uu / L, y: vv / W }
  }

  // v of a side's right / left service court centre (a side's "right" depends on which way it faces).
  const courtV = (side, court) => {
    const aRight = court === 'right'
    // Team A faces +u: its right hand points to +v. Team B faces -u: right is -v.
    const sign = (side === 'A') === aRight ? 1 : -1
    return CX + sign * courtCenter
  }

  const chips = []
  if (state && playersA?.length && playersB?.length) {
    const who = whoIsWho(state, perSide)
    const place = (side, players) => {
      const rightIdx = side === 'A' ? state.rightA : state.rightB
      const isServingSide = state.serving === side
      players.slice(0, perSide).forEach((player, idx) => {
        // Which court is this player standing in?
        const court = perSide === 1 ? who[isServingSide ? 'server' : 'receiver'].court : idx === rightIdx ? 'right' : 'left'
        const isServer = who.server.side === side && who.server.playerIdx === idx
        const isReceiver = who.receiver.side === side && who.receiver.playerIdx === idx
        // Distance from the net: the two players in play stand a little back from the short service line,
        // partners wait close to the net.
        const inPlay = isServer || isReceiver
        const dist = perSide === 1 ? (isServer ? 2.4 : 3.8) : inPlay ? 3.0 : 1.7
        const u = side === 'A' ? NET - dist : NET + dist
        const v = courtV(side, court)
        const { x, y } = toScreen(u, v)
        chips.push({ key: `${side}${idx}`, side, player, x, y, isServer })
      })
    }
    place('A', playersA)
    place('B', playersB)
  }

  const chipW = portrait ? 2.5 / W : 2.5 / L
  const chipH = portrait ? 2.5 / L : 2.5 / W
  const ratio = portrait ? W / L : L / W
  const initials = (name) =>
    (name ?? '?')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

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
            {/* playing area: doubles court */}
            <rect x="1" y="1" width="13.4" height="6.1" className="fill-panel-alt" />
            <rect x="1" y="1" width={NET - 1} height="6.1" className={TEAM_CLASS.A.fill} fillOpacity="0.12" />
            <rect x={NET} y="1" width={NET - 1} height="6.1" className={TEAM_CLASS.B.fill} fillOpacity="0.12" />
            <rect x="1" y="1" width="13.4" height="6.1" fill="none" className="stroke-ink-dim" strokeWidth="0.08" />
            {/* singles side lines */}
            <line x1="1" y1="1.46" x2="14.4" y2="1.46" className="stroke-ink-dim" strokeWidth="0.06" />
            <line x1="1" y1="6.64" x2="14.4" y2="6.64" className="stroke-ink-dim" strokeWidth="0.06" />
            {/* doubles long service lines (back boundary for doubles serve) */}
            <line x1="1.76" y1="1" x2="1.76" y2="7.1" className="stroke-ink-dim" strokeWidth="0.06" />
            <line x1="13.64" y1="1" x2="13.64" y2="7.1" className="stroke-ink-dim" strokeWidth="0.06" />
            {/* short service lines */}
            <line x1="5.72" y1="1" x2="5.72" y2="7.1" className="stroke-ink-dim" strokeWidth="0.06" />
            <line x1="9.68" y1="1" x2="9.68" y2="7.1" className="stroke-ink-dim" strokeWidth="0.06" />
            {/* centre lines, from the short service line to the back line */}
            <line x1="1" y1={CX} x2="5.72" y2={CX} className="stroke-ink-dim" strokeWidth="0.06" />
            <line x1="9.68" y1={CX} x2="14.4" y2={CX} className="stroke-ink-dim" strokeWidth="0.06" />
            {/* net */}
            <line x1={NET} y1="0.6" x2={NET} y2="7.5" className="stroke-ink" strokeWidth="0.16" />
            <circle cx={NET} cy="0.6" r="0.16" className="fill-ink" />
            <circle cx={NET} cy="7.5" r="0.16" className="fill-ink" />
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

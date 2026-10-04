import { TEAM_CLASS } from '../../lib/teamColors'

/**
 * Top-down court, drawn in real proportions (18 m x 9 m plus a free zone).
 * Logical coordinates: u runs along the length (0..22), v across the width
 * (0..13). In portrait the whole picture is turned 90 degrees so it fills a
 * tall phone screen. Team A is on the left / top, Team B on the right /
 * bottom. Positions follow the standard numbering from each team's own side
 * (1 = back right = server, 2 = front right, 3 = front middle, 4 = front
 * left, 5 = back left, 6 = back middle). Rotation array index 0..5 is
 * position 1..6. Players slide to their new spot when the team rotates.
 * Used by the scoring screen (tap to select) and the public watch page
 * (view only: pass locked).
 */
const COURT_LEN = 22
const COURT_WID = 13
const CHIP = 2.7
const SPOTS = {
  A: { 4: [9.5, 3.5], 3: [9.5, 6.5], 2: [9.5, 9.5], 5: [5, 3.5], 6: [5, 6.5], 1: [5, 9.5] },
  B: { 4: [12.5, 9.5], 3: [12.5, 6.5], 2: [12.5, 3.5], 5: [17, 9.5], 6: [17, 6.5], 1: [17, 3.5] },
}

export default function VolleyballCourt({
  portrait,
  rotationA,
  rotationB,
  rosterA,
  rosterB,
  servingTeam,
  liberoA = null,
  liberoB = null,
  selected = null,
  locked = false,
  tallies = new Map(),
  onSelectPlayer = () => {},
}) {
  const toScreen = (u, v) =>
    portrait ? { x: (COURT_WID - v) / COURT_WID, y: u / COURT_LEN } : { x: u / COURT_LEN, y: v / COURT_WID }
  const chipW = portrait ? CHIP / COURT_WID : CHIP / COURT_LEN
  const chipH = portrait ? CHIP / COURT_LEN : CHIP / COURT_WID
  const ratio = portrait ? COURT_WID / COURT_LEN : COURT_LEN / COURT_WID

  const chips = []
  for (const side of ['A', 'B']) {
    const rotation = side === 'A' ? rotationA : rotationB
    const roster = side === 'A' ? rosterA : rosterB
    const libero = side === 'A' ? liberoA : liberoB
    for (let pos = 1; pos <= 6; pos++) {
      const id = rotation[pos - 1]
      const p = roster.find((r) => r.id === id)
      if (!p) continue
      const [u, v] = SPOTS[side][pos]
      const { x, y } = toScreen(u, v)
      const isSelected = selected?.side === side && selected.playerId === id
      const isServer = servingTeam === side && pos === 1
      const isLibero = id === libero
      const t = tallies.get(id)
      const points = t ? t.kills + t.aces + t.blocks : 0
      chips.push(
        <button
          key={id}
          type="button"
          disabled={locked}
          title={p.name}
          onClick={() => onSelectPlayer(side, id)}
          className={`absolute flex flex-col items-center justify-center rounded-md leading-none disabled:opacity-70 border-2 ${
            isSelected ? 'bg-accent text-on-accent border-ink' : `bg-page text-ink ${TEAM_CLASS[side].border}`
          } ${isServer ? 'ring-2 ring-ink' : ''}`}
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: `${chipW * 100}%`,
            height: `${chipH * 100}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'left .45s ease, top .45s ease',
            padding: 0,
          }}
        >
          <span style={{ fontSize: portrait ? 'max(11px, 5cqw)' : 'max(11px, 3.2cqw)', fontWeight: 700 }}>
            {p.jerseyNumber ? `#${p.jerseyNumber}` : '-'}
          </span>
          <span
            style={{
              fontSize: portrait ? 'max(8px, 3cqw)' : 'max(8px, 2cqw)',
              maxWidth: '96%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {p.name}
          </span>
          {isServer && (
            <span className="absolute top-0 right-0 bg-ink text-page rounded-bl" style={{ fontSize: 8, padding: '1px 3px' }}>
              S
            </span>
          )}
          {isLibero && (
            <span className="absolute top-0 right-0 bg-warn text-on-warn rounded-bl" style={{ fontSize: 8, padding: '1px 3px' }}>
              L
            </span>
          )}
          {points > 0 && (
            <span className={`absolute bottom-0 right-0 text-on-accent rounded-tl ${TEAM_CLASS[side].bg}`} style={{ fontSize: 8, padding: '1px 3px' }}>
              {points}
            </span>
          )}
        </button>
      )
    }
  }

  return (
    <div className="absolute inset-0" style={{ containerType: 'size' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(100cqw, calc(100cqh * ${ratio}))`,
          aspectRatio: `${portrait ? COURT_WID : COURT_LEN} / ${portrait ? COURT_LEN : COURT_WID}`,
          containerType: 'inline-size',
        }}
      >
        <svg
          viewBox={portrait ? `0 0 ${COURT_WID} ${COURT_LEN}` : `0 0 ${COURT_LEN} ${COURT_WID}`}
          className="absolute inset-0 w-full h-full rounded-lg"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g transform={portrait ? `translate(${COURT_WID} 0) rotate(90)` : undefined}>
            <rect x="0" y="0" width="22" height="13" className="fill-panel" />
            <rect x="0.5" y="0.5" width="21" height="12" fill="none" className="stroke-ink-faint" strokeOpacity="0.6" strokeWidth="0.06" strokeDasharray="0.35 0.25" />
            <rect x="2" y="2" width="18" height="9" className="fill-panel-alt" />
            <rect x="2" y="2" width="9" height="9" className={TEAM_CLASS.A.fill} fillOpacity="0.12" />
            <rect x="11" y="2" width="9" height="9" className={TEAM_CLASS.B.fill} fillOpacity="0.12" />
            <rect x="2" y="2" width="18" height="9" fill="none" className="stroke-ink-dim" strokeWidth="0.12" />
            <line x1="8" y1="2" x2="8" y2="11" className="stroke-ink-dim" strokeWidth="0.1" />
            <line x1="14" y1="2" x2="14" y2="11" className="stroke-ink-dim" strokeWidth="0.1" />
            <line x1="11" y1="1.4" x2="11" y2="11.6" className="stroke-ink" strokeWidth="0.22" />
            <circle cx="11" cy="1.4" r="0.2" className="fill-ink" />
            <circle cx="11" cy="11.6" r="0.2" className="fill-ink" />
          </g>
        </svg>
        {chips}
      </div>
    </div>
  )
}

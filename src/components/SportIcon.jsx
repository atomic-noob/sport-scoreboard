import { Trophy } from 'lucide-react'

/**
 * Simple line icons for the sports, drawn to match the rest of the icon set
 * (Lucide: 24px grid, 1.75 stroke). Use <SportIcon sport="volleyball" />.
 */
export default function SportIcon({ sport, className = 'w-4 h-4', strokeWidth = 1.75 }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  }

  if (sport === 'basketball') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 2.5v19M2.5 12h19" />
        <path d="M5.2 5.2c3.2 3.4 3.2 9.2 0 13.6M18.8 5.2c-3.2 3.4-3.2 9.2 0 13.6" />
      </svg>
    )
  }

  if (sport === 'volleyball') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 2.5c0 5.2 2.6 8.6 7.6 10.4" />
        <path d="M4.2 7.2c4.8 .4 8.2 2.8 9.8 7.6" />
        <path d="M10.2 21.3c-.6-4.6 1-8.2 5.4-10.6" />
      </svg>
    )
  }

  if (sport === 'badminton') {
    // A shuttlecock: rounded cork head at the bottom, feather skirt fanning up.
    return (
      <svg {...common}>
        <path d="M9.2 14.5a2.8 2.8 0 0 0 5.6 0z" />
        <path d="M9.2 14.5L6 3.5M14.8 14.5L18 3.5M12 14.5V3" />
        <path d="M6.9 6.6Q12 8.4 17.1 6.6M7.9 10.2Q12 11.8 16.1 10.2" />
        <path d="M10.4 18.2h3.2" />
      </svg>
    )
  }

  return <Trophy className={className} strokeWidth={strokeWidth} aria-hidden="true" />
}

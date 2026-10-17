import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, Layers, Tv, X } from 'lucide-react'
import SportIcon from './SportIcon'
import { SPORT_LIST } from '../lib/sportConfig'

/**
 * Organizer navigation: jump between sports from any page. On large screens it
 * sits to the left of the page; on phones and tablets it slides in from the
 * left when the menu button in the header is tapped (open / onClose).
 */
function NavItem({ to, end = false, icon, children, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-panel-alt hover:text-ink'
        }`
      }
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </NavLink>
  )
}

function SidebarBody({ onNavigate }) {
  return (
    <nav className="p-3 space-y-5" aria-label="Main">
      <div className="space-y-1">
        <NavItem to="/dashboard" icon={<LayoutDashboard className="w-4.5 h-4.5" />} onNavigate={onNavigate}>Dashboard</NavItem>
      </div>

      <div>
        <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Sports</p>
        <div className="space-y-1">
          {SPORT_LIST.map((s) => (
            <NavItem key={s.key} to={`/${s.key}`} icon={<SportIcon sport={s.key} className="w-[18px] h-[18px]" />} onNavigate={onNavigate}>
              {s.label}
            </NavItem>
          ))}
        </div>
      </div>

      <div>
        <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">More</p>
        <div className="space-y-1">
          <NavItem to="/events" icon={<Layers className="w-[18px] h-[18px]" />} onNavigate={onNavigate}>Events</NavItem>
          <Link
            to="/watch"
            target="_blank"
            rel="noreferrer"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-dim hover:bg-panel-alt hover:text-ink transition"
          >
            <span className="w-5 h-5 flex items-center justify-center shrink-0"><Tv className="w-[18px] h-[18px]" /></span>
            <span className="truncate">Watch live</span>
            <span className="ml-auto text-[10px] text-ink-faint">opens new tab</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default function AppSidebar({ open, onClose }) {
  return (
    <>
      {/* Large screens: always visible, sticks under the header */}
      <aside className="hidden lg:block relative z-10 w-60 shrink-0 border-r border-line bg-panel sticky top-0 self-start h-screen overflow-y-auto">
        <SidebarBody />
      </aside>

      {/* Phones and tablets: slide-in drawer */}
      <div className={`lg:hidden fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-64 max-w-[80%] border-r border-line bg-panel overflow-y-auto transition-transform duration-200 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-line">
            <span className="font-bold text-ink">Sylve</span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-ink-dim hover:text-ink hover:bg-panel-alt" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          </div>
          <SidebarBody onNavigate={onClose} />
        </aside>
      </div>
    </>
  )
}

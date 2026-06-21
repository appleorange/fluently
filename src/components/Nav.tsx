'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/practice', label: 'Practice' },
  { href: '/progress', label: 'Progress' },
  { href: '/reports', label: 'Reports' },
  { href: '/resources', label: 'Resources' },
]

function WaveformIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="1" y="9" width="2.5" height="4" rx="1.25" fill="#2563eb" />
      <rect x="5.5" y="6" width="2.5" height="10" rx="1.25" fill="#2563eb" />
      <rect x="10" y="3" width="2.5" height="16" rx="1.25" fill="#2563eb" />
      <rect x="14.5" y="6" width="2.5" height="10" rx="1.25" fill="#2563eb" />
      <rect x="19" y="9" width="2.5" height="4" rx="1.25" fill="#2563eb" />
    </svg>
  )
}

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <WaveformIcon />
          <span className="font-bold text-slate-800 text-base tracking-tight">Fluently</span>
        </Link>

        <div className="flex items-center">
          {NAV_LINKS.map(link => {
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-5 text-sm font-medium transition-colors ${
                  isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </Link>
            )
          })}
        </div>

        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.61-9.6 4.8v2.4h19.2v-2.4c0-3.19-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
      </div>
    </nav>
  )
}

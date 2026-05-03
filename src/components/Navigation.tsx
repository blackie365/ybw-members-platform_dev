'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const navLinks = [
  { title: 'Home', href: '/' },
  { title: 'Latest Issue', href: '/news' },
  { title: 'About', href: '/news?tag=about' },
  { title: 'Contact', href: '/news?tag=contact' },
  { title: 'Members Hub', href: '/dashboard' },
  { title: 'Events', href: '/news?tag=events' },
  { title: 'Members Directory', href: '/members' },
]

export function Navigation({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={className}>
      <ul className="flex items-center gap-6">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href.split('?')[0]))
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={clsx(
                  "text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {link.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

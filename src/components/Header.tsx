import { forwardRef } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { Navigation } from '@/components/Navigation'
import { UserDropdown } from '@/components/UserDropdown'
import { ThemeToggle } from '@/components/ThemeToggle'

export const Header = forwardRef<React.ElementRef<'div'>, { className?: string }>(
  function Header({ className }, ref) {
    return (
      <div
        ref={ref}
        className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8"
      >
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="Home" className="lg:hidden">
            <Logo className="h-8" />
          </Link>
          <div className="hidden lg:flex items-center gap-8">
            <Navigation className="flex items-center gap-6" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <UserDropdown />
        </div>
      </div>
    )
  },
)

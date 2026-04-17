import clsx from 'clsx'
import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { forwardRef } from 'react'

import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'
import {
  MobileNavigation,
  useIsInsideMobileNavigation,
  useMobileNavigationStore,
} from '@/components/MobileNavigation'
import { MobileSearch, Search } from '@/components/Search'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CloseButton } from '@headlessui/react'
import { useAuth } from '@/lib/AuthContext'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'

function TopLevelNavItem({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm/5 text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        {children}
      </Link>
    </li>
  )
}

export const Header = forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<typeof motion.div>
>(function Header({ className, ...props }, ref) {
  let { isOpen: mobileNavIsOpen } = useMobileNavigationStore()
  let isInsideMobileNavigation = useIsInsideMobileNavigation()
  let pathname = usePathname()

  const isFullWidthRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/members') || pathname === '/' || pathname.startsWith('/news') || pathname.startsWith('/login') || pathname.startsWith('/register');

  let { scrollY } = useScroll()
  let bgOpacityLight = useTransform(scrollY, [0, 72], ['50%', '90%'])
  let bgOpacityDark = useTransform(scrollY, [0, 72], ['20%', '80%'])
  let { user, loading } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Failed to sign out', error)
    }
  }

  return (
    <motion.div
      {...props}
      ref={ref}
      className={clsx(
        className,
        'fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-12 px-4 transition sm:px-6 lg:z-30 lg:px-8',
        !isFullWidthRoute && 'lg:left-72 xl:left-80',
        !isInsideMobileNavigation && 'backdrop-blur-xs dark:backdrop-blur-sm',
        !isInsideMobileNavigation && !isFullWidthRoute && 'lg:left-72 xl:left-80',
        isInsideMobileNavigation
          ? 'bg-white dark:bg-zinc-900'
          : 'bg-white/(--bg-opacity-light) dark:bg-zinc-900/(--bg-opacity-dark)',
      )}
      style={
        {
          '--bg-opacity-light': bgOpacityLight,
          '--bg-opacity-dark': bgOpacityDark,
        } as React.CSSProperties
      }
    >
      <div
        className={clsx(
          'absolute inset-x-0 top-full h-px transition',
          (isInsideMobileNavigation || !mobileNavIsOpen) &&
            'bg-zinc-900/7.5 dark:bg-white/7.5',
        )}
      />
      
      {/* Search and Logo */}
      <div className="flex items-center gap-5">
        <div className={clsx("hidden lg:flex", !isFullWidthRoute && "lg:hidden")}>
          <Link href="/" aria-label="Home">
            <Logo className="h-6" />
          </Link>
        </div>
        <Search />
      </div>

      <div className="flex items-center gap-5 lg:hidden">
        <MobileNavigation />
        <CloseButton as={Link} href="/" aria-label="Home">
          <Logo className="h-6" />
        </CloseButton>
      </div>
      <div className="flex items-center gap-5">
        <nav className="hidden lg:block">
          <ul role="list" className="flex items-center gap-6 xl:gap-8">
            <TopLevelNavItem href="/">Home</TopLevelNavItem>
            <TopLevelNavItem href="/news">Latest Issue</TopLevelNavItem>
            <TopLevelNavItem href="/news?tag=about">About</TopLevelNavItem>
            <TopLevelNavItem href="/news?tag=contact">Contact</TopLevelNavItem>
            <TopLevelNavItem href="/dashboard">Members Hub</TopLevelNavItem>
            <TopLevelNavItem href="/news?tag=events">Events</TopLevelNavItem>
            <TopLevelNavItem href="/members">Members Directory</TopLevelNavItem>
          </ul>
        </nav>
        <div className="hidden lg:block lg:h-5 lg:w-px lg:bg-zinc-900/10 lg:dark:bg-white/15" />
        <div className="flex gap-4">
          <MobileSearch />
          <ThemeToggle />
        </div>
        <div className="hidden min-[416px]:contents">
          {!loading && user ? (
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          ) : (
            <Button href="/login">Sign in</Button>
          )}
        </div>
      </div>
    </motion.div>
  )
})

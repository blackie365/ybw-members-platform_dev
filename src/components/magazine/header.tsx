"use client"

import Link from "next/link"
import { Menu, Search, User, LogOut, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Logo } from "@/components/Logo"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useAuth } from "@/lib/AuthContext"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'News', href: '/news' },
  { name: 'Events', href: '/news?tag=events' },
  { name: 'Members', href: '/members' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

export function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className="bg-[#f7f5f1] dark:bg-zinc-950">
      {/* Top Banner (Ad) */}
      <div className="border-b border-border bg-[#f7f5f1] dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl justify-center px-4 py-6 lg:px-8">
          <div className="flex h-[90px] w-full max-w-[728px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-black/5 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50">
            Advertisement Space (728x90)
          </div>
        </div>
      </div>

      {/* Sticky Navigation */}
      <div className="sticky top-0 z-50 border-b border-border bg-[#f7f5f1]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f7f5f1]/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          {/* Mobile menu */}
          <div className="flex flex-1 justify-start lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] bg-background">
                <nav className="mt-8 flex flex-col gap-6">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="font-serif text-lg tracking-wide text-foreground transition-colors hover:text-accent"
                    >
                      {item.name}
                    </Link>
                  ))}
                  <Link
                    href="/dashboard"
                    className="font-serif text-lg tracking-wide text-foreground transition-colors hover:text-accent"
                  >
                    Dashboard
                  </Link>
                  {!user && (
                    <Link
                      href="/login"
                      className="font-serif text-lg tracking-wide text-foreground transition-colors hover:text-accent"
                    >
                      Sign In
                    </Link>
                  )}
                  {user && (
                    <button
                      onClick={handleSignOut}
                      className="font-serif text-lg tracking-wide text-left text-zinc-500 hover:text-red-600 transition-colors"
                    >
                      Sign Out
                    </button>
                  )}
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="flex items-center gap-4">
                      <span className="font-serif text-lg tracking-wide text-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Logo (Left on Desktop, Center on Mobile) */}
          <div className="flex lg:flex-1 justify-center lg:justify-start">
             <Link href="/" aria-label="Home">
               <Logo className="h-6 sm:h-8" />
             </Link>
          </div>

          {/* Desktop navigation (Centered) */}
          <div className="hidden lg:flex lg:items-center lg:justify-center lg:gap-8 lg:flex-[2]">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:text-accent"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Actions (Right) */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/dashboard" passHref>
                  <Button variant="ghost" size="icon" className="hidden lg:flex" aria-label="Dashboard">
                    <User className="h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hidden lg:flex" 
                  aria-label="Sign out"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" passHref>
                  <Button variant="ghost" size="icon" className="hidden lg:flex" aria-label="Sign In">
                    <LogIn className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/membership" passHref>
                  <Button className="ml-2 hidden rounded-full bg-primary px-6 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 lg:inline-flex">
                    Join Us
                  </Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, User, LogOut } from "lucide-react"
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
  { name: 'Latest Edition', href: '/new-edition' },
  { name: 'News', href: '/news' },
  { name: 'Events', href: '/events' },
  { name: 'Members', href: '/members' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

export function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setIsOpen(false);
      router.push('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className="bg-background">
      {/* Top Banner */}
      <div className="border-b border-border/60 bg-background">
        <div className="mx-auto flex max-w-7xl justify-center px-4 py-5 lg:px-8">
          <div className="flex h-[90px] w-full max-w-[728px] items-center justify-center rounded-sm border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
            Advertisement Space
          </div>
        </div>
      </div>

      {/* Sticky Navigation */}
      <div className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          {/* Mobile menu */}
          <div className="flex flex-1 justify-start lg:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-muted" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] bg-background p-0">
                <div className="flex h-full flex-col">
                  <div className="border-b border-border px-6 py-5">
                    <Logo className="h-6" />
                  </div>
                  <nav className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="space-y-1">
                      {navigation.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className="block py-3 font-serif text-lg text-foreground transition-colors hover:text-accent"
                        >
                          {item.name}
                        </Link>
                      ))}
                      <div className="my-4 h-px bg-border" />
                      <Link
                        href="/dashboard"
                        onClick={() => setIsOpen(false)}
                        className="block py-3 font-serif text-lg text-foreground transition-colors hover:text-accent"
                      >
                        Dashboard
                      </Link>
                      {!user && (
                        <>
                          <Link
                            href="/login"
                            onClick={() => setIsOpen(false)}
                            className="block py-3 font-serif text-lg text-foreground transition-colors hover:text-accent"
                          >
                            Sign In
                          </Link>
                          <Link
                            href="/membership"
                            onClick={() => setIsOpen(false)}
                            className="block py-3 font-serif text-lg text-accent transition-colors hover:text-accent/80 font-semibold"
                          >
                            Join Us
                          </Link>
                        </>
                      )}
                    </div>
                  </nav>
                  <div className="border-t border-border px-6 py-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                    {user && (
                      <button
                        onClick={handleSignOut}
                        className="mt-4 flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Logo */}
          <div className="flex lg:flex-1 justify-center lg:justify-start">
             <Link href="/" aria-label="Home" className="transition-opacity hover:opacity-80">
               <Logo className="h-6 sm:h-7" />
             </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden lg:flex lg:items-center lg:justify-center lg:gap-10 lg:flex-[2]">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground transition-colors hover:text-accent after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-accent after:transition-all hover:after:w-full"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-1 items-center justify-end gap-3">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/dashboard" passHref>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="hidden lg:flex hover:bg-muted" 
                    aria-label="Dashboard"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hidden lg:flex hover:bg-muted" 
                  aria-label="Sign out"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" passHref>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="hidden lg:flex hover:bg-muted" 
                    aria-label="Sign In"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/membership" passHref>
                  <Button className="ml-2 inline-flex bg-accent px-4 py-2 sm:px-6 sm:py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-foreground shadow-sm transition-all hover:bg-accent/90 hover:shadow-md">
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

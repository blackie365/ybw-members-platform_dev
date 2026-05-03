"use client"

import Link from "next/link"
import { Menu, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Logo } from "@/components/Logo"

const navigation = [
  { name: "News", href: "/news" },
  { name: "Members", href: "/members" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
]

export function Header() {
  return (
    <header className="bg-background">
      {/* Top Banner (Logo + Ad) */}
      <div className="border-b border-border bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-6 md:flex-row lg:px-8">
          <Link href="/" aria-label="Home" className="flex-shrink-0">
            <Logo className="h-12 sm:h-16" />
          </Link>
          <div className="flex h-[90px] w-full max-w-[728px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-100 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50">
            Advertisement Space (728x90)
          </div>
        </div>
      </div>

      {/* Sticky Navigation */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
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
              </nav>
            </SheetContent>
          </Sheet>

          {/* Desktop navigation (Left) */}
          <div className="hidden lg:flex lg:items-center lg:gap-8">
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

          {/* Mobile Logo Fallback (If needed) */}
          <div className="lg:hidden">
             <span className="font-serif text-xl font-semibold tracking-tight">
               YBW
             </span>
          </div>

          {/* Actions (Right) */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard" passHref>
              <Button variant="ghost" size="icon" className="hidden lg:flex" aria-label="Account">
                <User className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/membership" passHref>
              <Button className="ml-2 hidden rounded-full bg-primary px-6 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 lg:inline-flex">
                Join Us
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}

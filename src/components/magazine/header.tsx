"use client"

import Link from "next/link"
import { Menu, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

const navigation = [
  { name: "Leadership", href: "#" },
  { name: "Finance", href: "#" },
  { name: "Innovation", href: "#" },
  { name: "Lifestyle", href: "#" },
  { name: "Events", href: "#" },
]

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
            </nav>
          </SheetContent>
        </Sheet>

        {/* Desktop navigation */}
        <div className="hidden lg:flex lg:items-center lg:gap-8">
          {navigation.slice(0, 3).map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:text-accent"
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Logo */}
        <Link href="/" className="flex flex-col items-center">
          <span className="font-serif text-2xl font-semibold tracking-tight lg:text-3xl">
            ELÉVATE
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Business & Beyond
          </span>
        </Link>

        {/* Right navigation */}
        <div className="hidden lg:flex lg:items-center lg:gap-8">
          {navigation.slice(3).map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:text-accent"
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:flex" aria-label="Account">
            <User className="h-4 w-4" />
          </Button>
          <Button className="ml-2 hidden rounded-full bg-primary px-6 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 lg:inline-flex">
            Subscribe
          </Button>
        </div>
      </nav>
    </header>
  )
}

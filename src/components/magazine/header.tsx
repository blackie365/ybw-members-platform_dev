"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Menu, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { AdSlot } from "@/components/magazine/AdSlot";

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'New Edition', href: '/new-edition' },
  { name: 'News', href: '/news' },
  { name: 'Offers', href: '/offers' },
  { name: 'Events', href: '/news?tag=events' },
  { name: 'Members', href: '/members' },
  { name: 'About', href: '/about' },
];

export type HeaderAdConfig = {
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
  enabled?: boolean;
  rotation?: {
    enabled?: boolean;
    intervalSeconds?: number;
    items?: Array<{
      id: string;
      enabled?: boolean;
      imageUrl?: string;
      linkUrl?: string;
      altText?: string;
      weight?: number;
      startAt?: string;
      endAt?: string;
    }>;
  };
};

export function Header({ headerAd }: { headerAd?: HeaderAdConfig }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const envHeaderAdImageUrl = process.env.NEXT_PUBLIC_HEADER_AD_IMAGE_URL;
  const envHeaderAdLinkUrl = process.env.NEXT_PUBLIC_HEADER_AD_LINK_URL;
  const envHeaderAdAltText = process.env.NEXT_PUBLIC_HEADER_AD_ALT_TEXT || "Advertisement";
  const headerAdEnabled = headerAd?.enabled !== false;

  const rotationEnabled = headerAdEnabled && headerAd?.rotation?.enabled === true;
  const rotationIntervalMs = useMemo(() => {
    const seconds = typeof headerAd?.rotation?.intervalSeconds === "number" ? headerAd.rotation.intervalSeconds : 30;
    return Math.min(3600, Math.max(5, Math.floor(seconds || 30))) * 1000;
  }, [headerAd?.rotation?.intervalSeconds]);

  const eligibleRotationItems = useMemo(() => {
    const now = new Date();
    const items = headerAd?.rotation?.items || [];
    return items
      .filter((item) => item && item.enabled !== false)
      .filter((item) => Boolean(item.imageUrl))
      .filter((item) => {
        const startAt = item.startAt ? new Date(item.startAt) : null;
        const endAt = item.endAt ? new Date(item.endAt) : null;
        if (startAt && Number.isFinite(startAt.getTime()) && now < startAt) return false;
        if (endAt && Number.isFinite(endAt.getTime()) && now > endAt) return false;
        return true;
      });
  }, [headerAd?.rotation?.items]);

  const [rotationBucket, setRotationBucket] = useState(() => Math.floor(Date.now() / rotationIntervalMs));
  useEffect(() => {
    if (!rotationEnabled || eligibleRotationItems.length < 2) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const now = Date.now();
      const nextBoundary = (Math.floor(now / rotationIntervalMs) + 1) * rotationIntervalMs;
      const delay = Math.max(250, nextBoundary - now + 20);
      timeoutId = setTimeout(() => {
        setRotationBucket(Math.floor(Date.now() / rotationIntervalMs));
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [eligibleRotationItems.length, rotationEnabled, rotationIntervalMs]);

  const rotatedItem = useMemo(() => {
    if (!rotationEnabled) return undefined;
    if (eligibleRotationItems.length === 0) return undefined;
    return eligibleRotationItems[rotationBucket % eligibleRotationItems.length];
  }, [eligibleRotationItems, rotationBucket, rotationEnabled]);

  const headerAdImageUrl = headerAdEnabled
    ? rotatedItem?.imageUrl || headerAd?.imageUrl || envHeaderAdImageUrl
    : undefined;
  const headerAdLinkUrl = headerAdEnabled
    ? rotatedItem?.linkUrl || headerAd?.linkUrl || envHeaderAdLinkUrl
    : undefined;
  const headerAdAltText = rotatedItem?.altText || headerAd?.altText || envHeaderAdAltText;

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
      router?.push('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className="bg-background">
      {/* Top Banner */}
      <div className="border-b border-border/60 bg-background">
        <div className="mx-auto flex max-w-7xl justify-center px-4 py-5 lg:px-8">
          {headerAdImageUrl ? (
            <AdSlot
              type="leaderboard"
              imageUrl={headerAdImageUrl}
              linkUrl={headerAdLinkUrl}
              altText={headerAdAltText}
            />
          ) : (
            <div className="flex h-[90px] w-full max-w-[728px] items-center justify-center rounded-sm border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
              Advertisement Space
            </div>
          )}
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
                      {navigation?.map((item) => (
                        <Link
                          key={item?.name}
                          href={item?.href}
                          onClick={() => setIsOpen(false)}
                          className="block py-3 font-serif text-lg text-foreground transition-colors hover:text-accent"
                        >
                          {item?.name}
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
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setIsOpen(false)}
                          className="block py-3 font-serif text-lg text-accent font-semibold transition-colors hover:text-accent/80"
                        >
                          Admin Panel
                        </Link>
                      )}
                      {!user && (
                        <>
                          <Link
                            href="/sign-in"
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
            {navigation?.map((item) => (
              <Link
                key={item?.name}
                href={item?.href}
                className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground transition-colors hover:text-accent after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-accent after:transition-all hover:after:w-full"
              >
                {item?.name}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-1 items-center justify-end gap-3">
            <ThemeToggle />
            {user ? (
              <>
                {isAdmin && (
                  <Link href="/admin" passHref title="Admin Panel">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="hidden lg:flex hover:bg-muted text-accent" 
                      aria-label="Admin Panel"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
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
                  <Link href="/sign-in" passHref>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="hidden lg:flex text-[10px] font-bold uppercase tracking-widest hover:text-accent"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/membership" passHref>
                    <Button 
                      size="sm" 
                      className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-none px-6 text-[10px] font-bold uppercase tracking-widest"
                    >
                      Join Now
                    </Button>
                  </Link>
                </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

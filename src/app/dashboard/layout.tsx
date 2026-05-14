'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 bg-[#f7f5f1] dark:bg-zinc-950 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl mb-8">
          Member Dashboard
        </h1>
        
        {/* 2 Column Grid -> Gives the center content much more room */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-12 mb-12">
          
          {/* Left Sidebar Navigation & Actions */}
          <aside className="lg:sticky lg:top-8 h-fit space-y-6">
            <nav className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-900">
              <ul className="space-y-6">
                <li>
                  <Link href="/dashboard" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard' ? 'text-accent' : 'text-foreground'}`}>
                    Dashboard Home
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/profile" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/profile' ? 'text-accent' : 'text-foreground'}`}>
                    My Profile
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/messages" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname.startsWith('/dashboard/messages') ? 'text-accent' : 'text-foreground'}`}>
                    Messages
                  </Link>
                </li>
                <li>
                  <Link href="/events" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/events' ? 'text-accent' : 'text-foreground'}`}>
                    Events
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/offers" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/offers' ? 'text-accent' : 'text-foreground'}`}>
                    Member Offers
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/directory" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/directory' ? 'text-accent' : 'text-foreground'}`}>
                    Directory
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/opportunities" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/opportunities' ? 'text-accent' : 'text-foreground'}`}>
                    Job & Board Roles
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/videos" className={`block text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/videos' ? 'text-accent' : 'text-foreground'}`}>
                    Video Library
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-900">
              <h3 className="font-serif text-xl font-medium text-foreground mb-6">Quick Actions</h3>
              <ul className="space-y-4">
                <li>
                  <Link href="/dashboard/submit-article" className="block text-xs font-semibold uppercase tracking-wider text-accent hover:text-foreground transition-colors">
                    + Submit an Article
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/profile" className="block text-xs font-semibold uppercase tracking-wider text-accent hover:text-foreground transition-colors">
                    Update Profile Picture
                  </Link>
                </li>
              </ul>
              
              <div className="mt-8 pt-8 border-t border-border">
                <button 
                  onClick={() => {
                    import('@/lib/firebase').then(({ auth }) => {
                      import('firebase/auth').then(({ signOut }) => {
                        signOut(auth).then(() => router.push('/'));
                      });
                    });
                  }}
                  className="block w-full text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-red-600 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Central Column */}
          <main className="min-w-0">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}

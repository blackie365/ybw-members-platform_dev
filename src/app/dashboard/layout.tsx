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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 dark:bg-zinc-900 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white mb-8">
          Member Dashboard
        </h1>
        
        {/* 2 Column Grid -> Gives the center content much more room */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-12 mb-12">
          
          {/* Left Sidebar Navigation & Actions */}
          <aside className="lg:sticky lg:top-8 h-fit space-y-6">
            <nav className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 dark:bg-zinc-800/50 dark:border-zinc-700/50">
              <ul className="space-y-4">
                <li>
                  <Link href="/dashboard" className={`block hover:text-indigo-600 dark:hover:text-indigo-400 ${pathname === '/dashboard' ? 'text-zinc-900 font-medium dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Upcoming Events
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/profile" className={`block hover:text-indigo-600 dark:hover:text-indigo-400 ${pathname === '/dashboard/profile' ? 'text-zinc-900 font-medium dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    My Profile
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/offers" className={`block hover:text-indigo-600 dark:hover:text-indigo-400 ${pathname === '/dashboard/offers' ? 'text-zinc-900 font-medium dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Member Offers
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/directory" className={`block hover:text-indigo-600 dark:hover:text-indigo-400 ${pathname === '/dashboard/directory' ? 'text-zinc-900 font-medium dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Directory
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/videos" className={`block hover:text-indigo-600 dark:hover:text-indigo-400 ${pathname === '/dashboard/videos' ? 'text-zinc-900 font-medium dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Video Library
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 dark:bg-zinc-800/50 dark:border-zinc-700/50">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Quick Actions</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <button className="w-full text-left text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    + Create a Post
                  </button>
                </li>
                <li>
                  <Link href="/dashboard/profile" className="w-full text-left text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 block">
                    Update Profile Picture
                  </Link>
                </li>
              </ul>
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
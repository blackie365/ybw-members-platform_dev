import { ReactNode } from 'react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white py-12 sm:py-16 dark:bg-zinc-900 min-h-screen">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white mb-8">
          Member Dashboard
        </h1>
        
        {/* 3 Column Grid -> Expanded to be full width */}
        <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_250px] xl:grid-cols-[280px_minmax(0,1fr)_300px] gap-6 lg:gap-8 mb-12">
          
          {/* Left Sidebar Navigation */}
          <aside className="lg:sticky lg:top-8 h-fit">
            <nav className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 dark:bg-zinc-800/50 dark:border-zinc-700/50">
              <ul className="space-y-4">
                <li>
                  <Link href="/dashboard" className="block text-zinc-900 font-medium hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400">
                    Upcoming Events
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/profile" className="block text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
                    My Profile
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/offers" className="block text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
                    Member Offers
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/directory" className="block text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
                    Directory
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Central Column */}
          <main className="min-w-0">
            {children}
          </main>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 dark:bg-zinc-800/50 dark:border-zinc-700/50">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Quick Actions</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <button className="w-full text-left text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    + Create a Post
                  </button>
                </li>
                <li>
                  <button className="w-full text-left text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    Update Profile Picture
                  </button>
                </li>
              </ul>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
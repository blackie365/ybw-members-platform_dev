'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { 
  LayoutDashboard, 
  User, 
  Mail, 
  Calendar, 
  Gift, 
  Users, 
  Briefcase, 
  Video,
  FileText,
  LogOut,
  ChevronRight
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Profile', href: '/dashboard/profile', icon: User },
  { name: 'Messages', href: '/dashboard/messages', icon: Mail, badge: true },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Member Offers', href: '/dashboard/offers', icon: Gift },
  { name: 'Directory', href: '/dashboard/directory', icon: Users },
  { name: 'Job & Board Roles', href: '/dashboard/opportunities', icon: Briefcase },
  { name: 'Video Library', href: '/dashboard/videos', icon: Video },
];

const quickActions = [
  { name: 'Submit an Article', href: '/dashboard/submit-article', icon: FileText },
  { name: 'Update Profile Picture', href: '/dashboard/profile', icon: User },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSignOut = () => {
    import('@/lib/firebase').then(({ auth }) => {
      if (auth) {
        import('firebase/auth').then(({ signOut }) => {
          signOut(auth).then(() => router.push('/'));
        });
      }
    });
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-muted border-t-accent"></div>
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Member Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome back! Manage your profile, connect with members, and explore opportunities.
          </p>
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-10">
          
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-8 h-fit space-y-6">
            {/* Main Navigation */}
            <nav className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Navigation
                </h2>
              </div>
              <ul className="p-2">
                {navItems.map((item) => {
                  const isActive = item.href === '/dashboard' 
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                  
                  return (
                    <li key={item.name}>
                      <Link 
                        href={item.href} 
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                          isActive 
                            ? 'bg-accent/10 text-accent font-medium' 
                            : 'text-foreground hover:bg-muted hover:text-accent'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />
                        <span className="flex-1">{item.name}</span>
                        {isActive && <ChevronRight className="h-4 w-4 text-accent" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Quick Actions */}
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Quick Actions
                </h2>
              </div>
              <ul className="p-4 space-y-3">
                {quickActions.map((action) => (
                  <li key={action.name}>
                    <Link 
                      href={action.href} 
                      className="flex items-center gap-3 text-sm text-accent hover:text-accent/80 transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10">
                        <action.icon className="h-4 w-4 text-accent" />
                      </div>
                      <span className="font-medium">{action.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              
              <div className="border-t border-border p-4">
                <button 
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 text-sm text-muted-foreground hover:text-destructive transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}

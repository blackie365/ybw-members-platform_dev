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
  { name: 'Directory', href: '/dashboard/directory', icon: Users },
  { name: 'Member Offers', href: '/dashboard/offers', icon: Gift },
  { name: 'Job & Board Roles', href: '/dashboard/opportunities', icon: Briefcase },
  { name: 'Video Library', href: '/dashboard/videos', icon: Video },
];

const quickActions = [
  { name: 'Update Profile', href: '/dashboard/profile', icon: User },
  { name: 'Submit an Offer', href: '/dashboard/offers/create', icon: Gift },
  { name: 'Event Access', href: '/events', icon: Calendar },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAdmin, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const currentPage = navItems.find(item => 
    item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
  );
  
  const pageTitle = currentPage?.name || 'Member Dashboard';

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
      {/* Black Header Section - Matches site-wide hero style */}
      <div className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-accent" />
          <div className="absolute -bottom-40 right-0 h-[400px] w-[400px] rounded-full bg-accent" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Member Portal
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground sm:text-5xl">
              {pageTitle}
            </h1>
            <p className="mt-6 text-lg text-primary-foreground/70 leading-relaxed max-w-2xl">
              Welcome back! Manage your profile, connect with members, and explore exclusive opportunities.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
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
                
                {isAdmin && (
                  <li>
                    <Link 
                      href="/admin/members" 
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                        pathname.startsWith('/admin') 
                          ? 'bg-accent/10 text-accent font-medium' 
                          : 'text-foreground hover:bg-muted hover:text-accent border border-accent/20'
                      }`}
                    >
                      <Users className={`h-4 w-4 ${pathname.startsWith('/admin') ? 'text-accent' : 'text-accent'}`} />
                      <span className="flex-1 font-semibold text-accent">Admin Panel</span>
                      <ChevronRight className="h-4 w-4 text-accent" />
                    </Link>
                  </li>
                )}
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

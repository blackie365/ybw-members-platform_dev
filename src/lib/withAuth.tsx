'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth, MembershipTier, UserRole } from './AuthContext';

interface WithAuthOptions {
  redirectTo?: string;
  requiredTier?: MembershipTier | MembershipTier[];
  requiredRole?: UserRole | UserRole[];
  requireEmailVerified?: boolean;
}

interface WithAuthProps {
  children: React.ReactNode;
  options?: WithAuthOptions;
  fallback?: React.ReactNode;
}

// Loading skeleton for protected pages
function AuthLoadingSkeleton() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Access denied component
function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-6 w-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h2 className="font-serif text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/**
 * Higher-order component for protecting routes
 * 
 * Usage:
 * ```tsx
 * <WithAuth options={{ requiredTier: 'premium' }}>
 *   <PremiumContent />
 * </WithAuth>
 * ```
 */
export function WithAuth({ children, options = {}, fallback }: WithAuthProps) {
  const { user, profile, loading, membershipTier, isAdmin } = useAuth();
  const router = useRouter();

  const {
    redirectTo = '/login',
    requiredTier,
    requiredRole,
    requireEmailVerified = false,
  } = options;

  useEffect(() => {
    if (!loading && !user) {
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname : '';
      router.push(`${redirectTo}?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [loading, user, router, redirectTo]);

  // Show loading state
  if (loading) {
    return fallback || <AuthLoadingSkeleton />;
  }

  // Not authenticated
  if (!user) {
    return fallback || <AuthLoadingSkeleton />;
  }

  // Check email verification if required
  if (requireEmailVerified && !user.emailVerified) {
    return (
      <AccessDenied message="Please verify your email address to access this content." />
    );
  }

  // Check membership tier if required
  if (requiredTier) {
    const tiers = Array.isArray(requiredTier) ? requiredTier : [requiredTier];
    const tierHierarchy: Record<MembershipTier, number> = {
      free: 0,
      premium: 1,
      founder: 2,
    };

    const userTierLevel = tierHierarchy[membershipTier];
    const minRequiredLevel = Math.min(...tiers.map((t) => tierHierarchy[t]));

    if (userTierLevel < minRequiredLevel) {
      return (
        <AccessDenied message="This content requires a premium membership. Upgrade your account to access." />
      );
    }
  }

  // Check role if required
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole = profile?.role || 'member';

    // Super admin has access to everything
    if (userRole !== 'super_admin' && !roles.includes(userRole)) {
      return (
        <AccessDenied message="You do not have permission to access this page." />
      );
    }
  }

  return <>{children}</>;
}

/**
 * Hook for checking auth status in components
 */
export function useRequireAuth(options: WithAuthOptions = {}) {
  const { user, profile, loading, membershipTier, isAdmin } = useAuth();
  const router = useRouter();

  const {
    redirectTo = '/login',
    requiredTier,
    requiredRole,
    requireEmailVerified = false,
  } = options;

  useEffect(() => {
    if (!loading && !user) {
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname : '';
      router.push(`${redirectTo}?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [loading, user, router, redirectTo]);

  const hasAccess = (() => {
    if (loading || !user) return false;

    if (requireEmailVerified && !user.emailVerified) return false;

    if (requiredTier) {
      const tiers = Array.isArray(requiredTier) ? requiredTier : [requiredTier];
      const tierHierarchy: Record<MembershipTier, number> = {
        free: 0,
        premium: 1,
        founder: 2,
      };

      const userTierLevel = tierHierarchy[membershipTier];
      const minRequiredLevel = Math.min(...tiers.map((t) => tierHierarchy[t]));

      if (userTierLevel < minRequiredLevel) return false;
    }

    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      const userRole = profile?.role || 'member';

      if (userRole !== 'super_admin' && !roles.includes(userRole)) return false;
    }

    return true;
  })();

  return {
    user,
    profile,
    loading,
    hasAccess,
    isAdmin,
    membershipTier,
  };
}

/**
 * Admin-only wrapper component
 */
export function AdminOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <WithAuth
      options={{ requiredRole: ['admin', 'super_admin'] }}
      fallback={fallback}
    >
      {children}
    </WithAuth>
  );
}

/**
 * Premium-only wrapper component
 */
export function PremiumOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <WithAuth
      options={{ requiredTier: ['premium', 'founder'] }}
      fallback={fallback}
    >
      {children}
    </WithAuth>
  );
}

'use client';

import { useAuth } from '@/lib/AuthContext';
import { AdminFeatureToggle } from './AdminFeatureToggle';

export function AdminControlWrapper({ memberId, isCurrentlyFeatured }: { memberId: string, isCurrentlyFeatured: boolean }) {
  const { user, profile, loading, isAdmin } = useAuth();

  // Explicitly check for user and admin status
  if (loading || !user || !isAdmin) return null;

  return (
    <div className="mt-8">
      <AdminFeatureToggle memberId={memberId} isCurrentlyFeatured={isCurrentlyFeatured} />
    </div>
  );
}
'use client';

import { useAuth } from '@/lib/AuthContext';
import { AdminFeatureToggle } from './AdminFeatureToggle';

export function AdminControlWrapper({ memberId, isCurrentlyFeatured }: { memberId: string, isCurrentlyFeatured: boolean }) {
  const { user, profile, loading } = useAuth();

  if (loading) return null;
  if (!profile?.isAdmin) return null;

  return (
    <div className="mt-8">
      <AdminFeatureToggle memberId={memberId} isCurrentlyFeatured={isCurrentlyFeatured} />
    </div>
  );
}
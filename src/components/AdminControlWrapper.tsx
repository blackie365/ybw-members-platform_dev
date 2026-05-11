'use client';

import { useAuth } from '@/lib/AuthContext';
import { AdminFeatureToggle } from './AdminFeatureToggle';

const ADMIN_EMAILS = [
  'rob@topicuk.co.uk',
  'admin@yorkshirebusinesswoman.co.uk'
];

export function AdminControlWrapper({ memberId, isCurrentlyFeatured }: { memberId: string, isCurrentlyFeatured: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || !user.email) return null;

  const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());

  if (!isAdmin) return null;

  return (
    <div className="mt-8">
      <AdminFeatureToggle memberId={memberId} isCurrentlyFeatured={isCurrentlyFeatured} />
    </div>
  );
}
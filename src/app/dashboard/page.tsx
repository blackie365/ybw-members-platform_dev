import { Suspense } from 'react';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { RecentNews } from '@/components/dashboard/RecentNews';
import { ExclusiveMemberOffers } from '@/components/dashboard/ExclusiveMemberOffers';
import { ExternalNewsWidget } from '@/components/dashboard/ExternalNewsWidget';
import { StatsSkeleton, WidgetSkeleton } from '@/components/dashboard/DashboardSkeletons';

export const revalidate = 60;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<StatsSkeleton />}>
        <QuickStats />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Upcoming Events" />}>
        <UpcomingEvents />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Member-Only Offers" />}>
        <ExclusiveMemberOffers />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Recent News" />}>
        <RecentNews />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Yorkshire News Updates" />}>
        <ExternalNewsWidget />
      </Suspense>
    </div>
  );
}

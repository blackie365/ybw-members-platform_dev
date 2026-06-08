'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFeaturedStatus } from '@/app/actions/adminActions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';

export function AdminFeatureToggle({ memberId, isCurrentlyFeatured }: { memberId: string, isCurrentlyFeatured: boolean }) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleToggle = async (checked: boolean) => {
    setIsPending(true);
    try {
      const res = await toggleFeaturedStatus(memberId, checked);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || 'Failed to update featured status');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-accent/5 p-4 rounded-xl border border-accent/20">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <Star className={`h-5 w-5 ${isCurrentlyFeatured ? 'fill-accent text-accent' : 'text-accent/40'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <Label htmlFor="featured-switch" className="text-sm font-semibold text-foreground cursor-pointer">
          Featured Member Status
        </Label>
        <p className="text-xs text-muted-foreground truncate">
          {isCurrentlyFeatured 
            ? 'Currently featured on the homepage' :'Toggle to feature this member on the homepage'}
        </p>
      </div>
      <Switch
        id="featured-switch"
        checked={isCurrentlyFeatured}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
    </div>
  );
}

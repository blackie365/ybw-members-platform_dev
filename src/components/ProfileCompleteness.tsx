'use client';

import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

interface ProfileCompletenessProps {
  compact?: boolean;
  showCTA?: boolean;
}

export function ProfileCompleteness({ compact = false, showCTA = true }: ProfileCompletenessProps) {
  const { profile, profileCompleteness } = useAuth();

  if (!profile) return null;

  // Determine color based on completeness
  const getColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-500';
    if (percentage >= 50) return 'text-amber-600 bg-amber-500';
    return 'text-accent bg-accent';
  };

  const colorClass = getColor(profileCompleteness);
  const [textColor, bgColor] = colorClass.split(' ');

  // Calculate what's missing
  const missingFields: string[] = [];
  if (!profile.profileImage) missingFields.push('Profile photo');
  if (!profile.companyName) missingFields.push('Company name');
  if (!profile.jobTitle) missingFields.push('Job title');
  if (!profile.bio) missingFields.push('Bio');
  if (!profile.location) missingFields.push('Location');
  if (!profile.industrySector) missingFields.push('Industry');
  if (!profile.linkedinUrl) missingFields.push('LinkedIn');

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-muted/30"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={textColor}
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${profileCompleteness}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-semibold ${textColor}`}>
            {profileCompleteness}%
          </span>
        </div>
        {profileCompleteness < 100 && showCTA && (
          <Link
            href="/dashboard/profile"
            className="text-sm text-accent hover:text-accent/80 transition-colors"
          >
            Complete profile
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-foreground">Profile Strength</h3>
        <span className={`text-sm font-semibold ${textColor}`}>{profileCompleteness}%</span>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className={`h-full ${bgColor} rounded-full transition-all duration-500`}
          style={{ width: `${profileCompleteness}%` }}
        />
      </div>

      {profileCompleteness < 100 && missingFields.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Complete your profile to increase visibility in the member directory.
          </p>
          <div className="flex flex-wrap gap-2">
            {missingFields.slice(0, 3).map((field) => (
              <span
                key={field}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {field}
              </span>
            ))}
            {missingFields.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                +{missingFields.length - 3} more
              </span>
            )}
          </div>
          {showCTA && (
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
            >
              Complete your profile
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}
        </div>
      )}

      {profileCompleteness === 100 && (
        <p className="text-sm text-green-600">
          Your profile is complete! You&apos;re getting maximum visibility.
        </p>
      )}
    </div>
  );
}

export default ProfileCompleteness;

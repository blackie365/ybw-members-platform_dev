'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

export function MemberCard({ member }: { member: any }) {
  const profileImage = member.image || member.avatarUrl || member.profileImage;
  const firstName = member.firstName || '';
  const lastName = member.lastName || '';
  const initial = firstName ? firstName[0].toUpperCase() : (member.name?.[0] || '?').toUpperCase();
  const bio = member.bio || '';
  const companyName = member.companyName || '';
  const location = member.location || '';

  // Check if image is a blank gravatar
  const isBlankGravatar = typeof profileImage === 'string' && profileImage.includes('gravatar.com/avatar') && profileImage.includes('d=blank');
  const hasRealImage = profileImage && !isBlankGravatar;

  return (
    <Link
      href={`/members/${member.memberSlug || member.id}`}
      className="group relative flex flex-col items-start justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-6 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20 h-full"
    >
      <div className="flex items-center gap-4 mb-4 w-full">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 shadow-inner">
          {hasRealImage ? (
            <Image
              src={profileImage}
              alt={firstName || 'Member'}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-serif font-medium text-accent bg-accent/5">
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-serif font-medium text-zinc-900 dark:text-white truncate group-hover:text-accent transition-colors">
            {firstName} {lastName}
          </h2>
          {companyName && (
            <p className="text-sm font-medium text-accent truncate">
              {companyName}
            </p>
          )}
        </div>
      </div>
      
      {location && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          <MapPin className="w-3.5 h-3.5" />
          <span>{location}</span>
        </div>
      )}

      <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-4 flex-1">
        {bio}
      </div>

      <div className="mt-auto w-full">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {member.openToMentoring && (
            <span className="inline-flex items-center rounded-md bg-accent/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-accent ring-1 ring-inset ring-accent/10">
              Coaching
            </span>
          )}
          {member.seekingMentorship && (
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/20">
              Seeking Coach
            </span>
          )}
          {member.openToBoardRoles && (
            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-700/10 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/20">
              Board Roles (NED)
            </span>
          )}
        </div>

        <div className="w-full pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <span className="text-sm font-medium text-accent hover:text-accent/80 transition-colors inline-flex items-center gap-1">
            View Profile <span>&rarr;</span>
          </span>
        </div>
      </div>
    </Link>
  );
}


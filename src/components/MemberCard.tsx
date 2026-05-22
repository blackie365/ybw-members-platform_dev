'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin, Briefcase } from 'lucide-react';

export function MemberCard({ member }: { member: any }) {
  // Name handling: prioritize displayName if it looks more complete than initials
  const hasInitialsOnly = (member.firstName?.length === 1 || member.lastName?.length === 1);
  const displayNameParts = member.displayName?.split(' ') || [];
  
  const firstName = (hasInitialsOnly && displayNameParts.length > 0) 
    ? displayNameParts[0] 
    : (member.firstName || displayNameParts[0] || '');
    
  const lastName = (hasInitialsOnly && displayNameParts.length > 1) 
    ? displayNameParts.slice(1).join(' ') 
    : (member.lastName || displayNameParts.slice(1).join(' ') || '');

  // Image handling: Use the pre-calculated image from the page, or find the best one
   const profileImage = member.image || [member.avatarUrl, member.profileImage, member.profileImageSource].find(url => 
     url && typeof url === 'string' && (url.includes('storage.googleapis.com') || url.includes('firebasestorage.app') || url.includes('firebasestorage.googleapis.com'))
   ) || [member.avatarUrl, member.profileImage, member.profileImageSource].find(url => 
     url && typeof url === 'string' && url.startsWith('http') && !url.includes('gravatar.com/avatar')
   ) || member.avatarUrl || member.profileImage;
   const initial = firstName ? firstName[0].toUpperCase() : (member.displayName?.[0] || member.name?.[0] || '?').toUpperCase();
  const bio = member.bio || '';
  const jobTitle = member.jobTitle || '';
  const companyName = member.companyName || '';
  const location = member.location || '';

  // Check if image is a blank gravatar
  const isBlankGravatar = typeof profileImage === 'string' && profileImage.includes('gravatar.com/avatar') && profileImage.includes('d=blank');
  const hasRealImage = profileImage && !isBlankGravatar;

  return (
    <Link
      href={`/members/${member.memberSlug || member.id}`}
      className="group relative flex flex-col items-start justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-6 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20"
    >
      <div className="flex items-center gap-4 mb-4 w-full">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full ring-2 ring-background shadow-sm bg-accent/5">
          {hasRealImage ? (
            <img
              src={profileImage}
              alt={firstName || 'Member'}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = "flex h-full w-full items-center justify-center text-xl font-serif font-medium text-accent bg-accent/10";
                  fallback.innerText = initial;
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-serif font-medium text-accent bg-accent/10">
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <h2 className="text-lg font-serif font-medium text-foreground group-hover:text-accent transition-colors truncate">
            {firstName} {lastName}
          </h2>
          {companyName && (
            <p className="text-sm font-medium text-accent truncate">
              {companyName}
            </p>
          )}
        </div>
      </div>
      
      {/* Location */}
      {location && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <MapPin className="w-3.5 h-3.5" />
          <span>{location}</span>
        </div>
      )}

      <div className="text-sm text-muted-foreground line-clamp-3 text-left mb-4 flex-1">
        {bio}
      </div>

      <div className="mt-auto w-full">
        {/* Tags */}
        {(member.openToMentoring || member.seekingMentorship || member.openToBoardRoles) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {member.openToMentoring && (
              <span className="inline-flex items-center px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10 rounded-md ring-1 ring-inset ring-accent/20">
                Coaching
              </span>
            )}
            {member.seekingMentorship && (
              <span className="inline-flex items-center px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10 rounded-md ring-1 ring-inset ring-accent/20">
                Seeking Coach
              </span>
            )}
            {member.openToBoardRoles && (
              <span className="inline-flex items-center px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10 rounded-md ring-1 ring-inset ring-accent/20">
                NED
              </span>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent group-hover:text-foreground transition-colors">
            View Profile
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>

  );
}

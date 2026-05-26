'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';

export function MemberCard({ member }: { member: any }) {
  const [imageError, setImageError] = useState(false);
  // Name handling: prioritize displayName if it looks more complete than initials
  const hasInitialsOnly = (member.firstName?.length === 1 || member.lastName?.length === 1);
  const displayNameParts = member.displayName?.split(' ') || [];
  
  const firstName = (hasInitialsOnly && displayNameParts.length > 0) 
    ? displayNameParts[0] 
    : (member.firstName || displayNameParts[0] || '');
    
  const lastName = (hasInitialsOnly && displayNameParts.length > 1) 
    ? displayNameParts.slice(1).join(' ') 
    : (member.lastName || displayNameParts.slice(1).join(' ') || '');

  // Image handling
  const profileImage = member.image || [member.avatarUrl, member.profileImage, member.profileImageSource].find(url => 
    url && typeof url === 'string' && (url.includes('storage.googleapis.com') || url.includes('firebasestorage.app') || url.includes('firebasestorage.googleapis.com'))
  ) || [member.avatarUrl, member.profileImage, member.profileImageSource].find(url => 
    url && typeof url === 'string' && url.startsWith('http') && !url.includes('gravatar.com/avatar')
  ) || member.avatarUrl || member.profileImage;
  
  const initial = firstName ? firstName[0].toUpperCase() : (member.displayName?.[0] || member.name?.[0] || '?').toUpperCase();
  const jobTitle = member.jobTitle || '';
  const companyName = member.companyName || '';
  const location = member.location || '';

  // Check if image is a blank gravatar
  const isBlankGravatar = typeof profileImage === 'string' && profileImage.includes('gravatar.com/avatar') && profileImage.includes('d=blank');
  const hasRealImage = profileImage && !isBlankGravatar;

  const tags = [
    member.openToMentoring && 'Coaching',
    member.seekingMentorship && 'Seeking Coach',
    member.openToBoardRoles && 'NED',
  ].filter(Boolean);

  return (
    <Link
      href={`/members/${member.memberSlug || member.id}`}
      className="group relative flex flex-col bg-background p-6 sm:p-8 transition-colors hover:bg-secondary"
    >
      {/* Content */}
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-muted">
          {hasRealImage && !imageError ? (
            <Image
              src={profileImage}
              alt={firstName || 'Member'}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              unoptimized={profileImage.includes('gravatar.com')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-serif text-foreground bg-muted">
              {initial}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-serif text-lg sm:text-xl font-normal text-foreground leading-tight">
              {firstName} {lastName}
            </h2>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
          </div>
          
          {(jobTitle || companyName) && (
            <p className="mt-1 text-sm text-muted-foreground truncate">
              {jobTitle}{jobTitle && companyName && ', '}{companyName}
            </p>
          )}
          
          {location && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-5 pt-5 border-t border-border flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span 
              key={tag} 
              className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

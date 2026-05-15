'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin, Briefcase } from 'lucide-react';

export function MemberCard({ member }: { member: any }) {
  const profileImage = member.avatarUrl || member.profileImage || member['Profile Image'];
  const firstName = member.firstName || member['First Name'] || '';
  const lastName = member.lastName || member['Last Name'] || '';
  const initial = firstName ? firstName[0].toUpperCase() : '?';
  const bio = member.bio || member['Bio'] || '';
  const jobTitle = member.jobTitle || '';
  const companyName = member.companyName || '';
  const location = member.location || '';

  return (
    <Link
      href={`/members/${member.memberSlug || member.slug || member.id}`}
      className="group relative flex flex-col bg-card border border-border overflow-hidden transition-all duration-300 hover:border-accent/40 hover:shadow-lg"
    >
      {/* Top accent bar that appears on hover */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
      
      {/* Profile header with image */}
      <div className="relative bg-primary/5 p-6 pb-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(var(--accent-rgb),0.08),transparent_60%)]" />
        
        {/* Avatar */}
        <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full ring-4 ring-background shadow-md">
          {profileImage && !profileImage.includes('gravatar.com/avatar') ? (
            <Image
              src={profileImage}
              alt={firstName || 'Member'}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-serif font-medium text-accent bg-accent/10">
              {initial}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-6 pt-4 -mt-6 relative">
        {/* Name and title */}
        <div className="text-center mb-4">
          <h2 className="font-serif text-xl font-medium text-foreground group-hover:text-accent transition-colors">
            {firstName} {lastName}
          </h2>
          {(jobTitle || companyName) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {jobTitle}{jobTitle && companyName && ' at '}{companyName}
            </p>
          )}
        </div>

        {/* Location */}
        {location && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-4">
            <MapPin className="w-3.5 h-3.5" />
            <span>{location}</span>
          </div>
        )}
        
        {/* Bio excerpt */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 text-center flex-1">
          {bio}
        </p>

        {/* Tags */}
        {(member.openToMentoring || member.seekingMentorship || member.openToBoardRoles) && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {member.openToMentoring && (
              <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10 rounded-full">
                Coaching
              </span>
            )}
            {member.seekingMentorship && (
              <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10 rounded-full">
                Seeking Coach
              </span>
            )}
            {member.openToBoardRoles && (
              <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10 rounded-full">
                NED
              </span>
            )}
          </div>
        )}

        {/* View profile link */}
        <div className="mt-6 pt-4 border-t border-border">
          <span className="inline-flex items-center justify-center w-full gap-2 text-xs font-medium uppercase tracking-wider text-accent group-hover:text-foreground transition-colors">
            View Profile
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}

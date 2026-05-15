import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function MemberCard({ member }: { member: any }) {
  const profileImage = member.avatarUrl || member.profileImage || member['Profile Image'];
  const firstName = member.firstName || member['First Name'] || '';
  const lastName = member.lastName || member['Last Name'] || '';
  const initial = firstName ? firstName[0].toUpperCase() : '?';
  const bio = member.bio || member['Bio'] || '';

  return (
    <div className="group relative flex flex-col bg-card border border-border p-6 transition-all hover:border-accent/30 hover:shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative h-14 w-14 flex-none overflow-hidden bg-muted">
          {profileImage && !profileImage.includes('gravatar.com/avatar') ? (
            <Image
              src={profileImage}
              alt={firstName || 'Member'}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-serif font-medium text-muted-foreground bg-accent/10">
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-lg font-medium text-foreground truncate">
            {firstName} {lastName}
          </h2>
          {member.companyName && (
            <p className="text-sm text-accent truncate">
              {member.companyName}
            </p>
          )}
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
        {bio}
      </p>

      {(member.openToMentoring || member.seekingMentorship || member.openToBoardRoles) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {member.openToMentoring && (
            <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10">
              Coaching
            </span>
          )}
          {member.seekingMentorship && (
            <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10">
              Seeking Coach
            </span>
          )}
          {member.openToBoardRoles && (
            <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent bg-accent/10">
              NED
            </span>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <Link
          href={`/members/${member.memberSlug || member.slug || member.id}`}
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors"
        >
          View Profile
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

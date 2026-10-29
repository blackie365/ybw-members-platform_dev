'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';

/**
 * The shape the directory hands to the client. Built server-side in
 * `app/members/page.tsx` so the card and the list row stay presentational and
 * no member record has to be re-derived (or, importantly, widened) in the
 * browser.
 */
export interface DirectoryMember {
  id: string;
  /** What `/members/[slug]` resolves: a unique member slug, else the Clerk id. */
  linkTarget: string;
  name: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: string;
  company: string;
  location: string;
  /** Normalised place name used to facet the directory ("Leeds/Wakefield" → "Leeds"). */
  locationFacet: string;
  bio: string;
  image: string;
  hasImage: boolean;
  tier: string;
  /** Paying members and founders carry the quiet gold accent. */
  isPremium: boolean;
  openToMentoring: boolean;
  seekingMentorship: boolean;
  openToBoardRoles: boolean;
  linkedin: string;
  website: string;
}

/**
 * A member with no photograph gets a typographic monogram rather than a grey
 * placeholder: Playfair on warm paper inside a hairline double rule.
 */
export function MemberMonogram({
  initials,
  premium = false,
  compact = false,
}: {
  initials: string;
  premium?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#faf8f3] dark:bg-[#231810]">
      <span
        aria-hidden
        className={`pointer-events-none absolute border border-[#e8e0d5] dark:border-[#3d2d20] ${
          compact ? 'inset-1' : 'inset-3'
        }`}
      />
      {!compact && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-4 border border-[#e8e0d5]/70 dark:border-[#3d2d20]/70"
        />
      )}
      <span
        className={`relative font-serif ${compact ? 'text-base' : 'text-4xl'} tracking-[0.08em] ${
          premium ? 'text-accent' : 'text-[#1c1410] dark:text-[#f5efe8]'
        }`}
      >
        {initials}
      </span>
    </div>
  );
}

function tagsFor(member: DirectoryMember): string[] {
  return [
    member.openToMentoring && 'Coaching',
    member.seekingMentorship && 'Seeking a coach',
    member.openToBoardRoles && 'NED',
  ].filter(Boolean) as string[];
}

export function MemberCard({ member }: { member: DirectoryMember }) {
  const [imageError, setImageError] = useState(false);
  const showImage = member.hasImage && Boolean(member.image) && !imageError;
  const subtitle = [member.role, member.company].filter(Boolean).join(' · ');
  const tags = tagsFor(member);

  return (
    <Link href={`/members/${member.linkTarget}`} className="group flex flex-col">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-secondary">
        {showImage ? (
          // Profile photos come from a mix of relative paths and third-party
          // hosts; serving them as-is keeps an unconfigured host from throwing
          // in the optimiser, and these are already small thumbnails.
          <Image
            src={member.image}
            alt={member.name}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 90vw"
            unoptimized
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            onError={() => setImageError(true)}
          />
        ) : (
          <MemberMonogram initials={member.initials} premium={member.isPremium} />
        )}

        {member.isPremium && (
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#c9956a] via-[#e8c49a] to-[#c9956a]"
          />
        )}

        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-background/90 text-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="flex flex-1 flex-col pt-5">
        <h3 className="font-serif text-xl leading-snug text-foreground transition-colors group-hover:text-accent">
          {member.name}
        </h3>

        {subtitle && (
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {subtitle}
          </p>
        )}

        {member.bio && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>
        )}

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          {member.location ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden />
              {member.location}
            </span>
          ) : (
            <span />
          )}
          <span
            aria-hidden
            className="h-px w-10 shrink-0 bg-border transition-colors group-hover:bg-accent/50"
          />
        </div>
      </div>
    </Link>
  );
}

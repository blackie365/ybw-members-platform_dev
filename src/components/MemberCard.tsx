'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

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
  /**
   * Whether the host is known to the image optimiser. Member photos come from a
   * mix of our own uploads and arbitrary third-party sites; the optimiser throws
   * on a host it does not know, so those few are served as-is instead.
   */
  optimizable: boolean;
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
 * placeholder: Playfair on warm paper inside a hairline double rule. Sits
 * directly on the card's plate, so it only draws its own inner rules.
 */
export function MemberMonogram({
  initials,
  premium = false,
  size = 'md',
}: {
  initials: string;
  premium?: boolean;
  size?: 'sm' | 'md';
}) {
  const large = size === 'md';
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#faf8f3] dark:bg-[#231810]">
      <span
        aria-hidden
        className={`pointer-events-none absolute border border-[#e8e0d5] dark:border-[#3d2d20] ${
          large ? 'inset-2' : 'inset-0.5'
        }`}
      />
      {large && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-3 border border-[#e8e0d5]/60 dark:border-[#3d2d20]/60"
        />
      )}
      <span
        className={`relative font-serif tracking-[0.08em] ${large ? 'text-2xl' : 'text-sm'} ${
          premium ? 'text-accent' : 'text-[#1c1410] dark:text-[#f5efe8]'
        }`}
      >
        {initials}
      </span>
    </div>
  );
}

/**
 * A contact-sheet tile: the photograph is mounted like a plate, inset on warm
 * paper behind a hairline rule. Keeping the photo at this size means a small or
 * low-resolution original is never blown up past its natural resolution — the
 * mount does the visual work instead.
 */
export function MemberCard({ member }: { member: DirectoryMember }) {
  const [imageError, setImageError] = useState(false);
  const showImage = member.hasImage && Boolean(member.image) && !imageError;
  const subtitle = [member.role, member.company].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/members/${member.linkTarget}`}
      title={subtitle ? `${member.name} — ${subtitle}` : member.name}
      className="group flex flex-col"
    >
      <div className="relative bg-[#faf8f3] p-1.5 shadow-[0_1px_2px_rgba(28,25,23,0.06)] ring-1 ring-[#e8e0d5] transition-colors duration-300 group-hover:ring-[#c9956a]/50 dark:bg-[#231810] dark:ring-[#3d2d20]">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#efe9df] dark:bg-[#2a1d14]">
          {showImage ? (
            <Image
              src={member.image}
              alt={member.name}
              fill
              // The container is capped at 1280px, so fixed widths describe the
              // slot far more accurately than viewport units.
              sizes="(min-width: 1024px) 140px, (min-width: 640px) 15vw, 29vw"
              unoptimized={!member.optimizable}
              className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              onError={() => setImageError(true)}
            />
          ) : (
            <MemberMonogram initials={member.initials} premium={member.isPremium} />
          )}
        </div>

        {member.isPremium && (
          <span
            aria-hidden
            className="absolute inset-x-1.5 top-1.5 h-px bg-gradient-to-r from-transparent via-[#c9956a] to-transparent"
          />
        )}
      </div>

      <h3 className="mt-2.5 line-clamp-2 font-serif text-[13px] leading-[1.3] text-foreground transition-colors group-hover:text-accent">
        {member.name}
      </h3>

      {subtitle && (
        <p className="mt-1 truncate text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {subtitle}
        </p>
      )}
    </Link>
  );
}

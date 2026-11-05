'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';

import { availabilityLabels } from '@/features/members/display';
import { cn } from '@/lib/utils';

/**
 * The minimum a portrait needs to render. Both the directory entry and the
 * member profile page build this, which is why the two surfaces cannot drift
 * apart on a member's photo, initials or accent.
 */
export interface PortraitSubject {
  name: string;
  initials: string;
  role: string;
  company: string;
  image: string;
  hasImage: boolean;
  /**
   * Whether the host is known to the image optimiser. Member photos come from a
   * mix of our own uploads and arbitrary third-party sites; the optimiser throws
   * on a host it does not know, so those few are served as-is instead.
   */
  optimizable: boolean;
  /** Paying members and founders carry the quiet gold accent. */
  isPremium: boolean;
}

/**
 * The shape the directory hands to the client. Built server-side in
 * `app/members/page.tsx` so the card and the list row stay presentational and
 * no member record has to be re-derived (or, importantly, widened) in the
 * browser.
 */
export interface DirectoryMember extends PortraitSubject {
  id: string;
  /** What `/members/[slug]` resolves: a unique member slug, else the Clerk id. */
  linkTarget: string;
  firstName: string;
  lastName: string;
  location: string;
  /** Normalised place name used to facet the directory ("Leeds/Wakefield" → "Leeds"). */
  locationFacet: string;
  bio: string;
  tier: string;
  openToMentoring: boolean;
  seekingMentorship: boolean;
  openToBoardRoles: boolean;
  linkedin: string;
  website: string;
  /**
   * ISO date the member joined, when the record carries one. Only used to build
   * the "Newest members" strip; members without a date are left out of it
   * rather than guessed at.
   */
  joinedAt: string;
}

/**
 * A member with no photograph gets a typographic monogram rather than a grey
 * placeholder: Playfair on warm paper inside a hairline double rule.
 */
export function MemberMonogram({
  initials,
  premium = false,
  size = 'md',
}: {
  initials: string;
  premium?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-plate">
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute border border-plate-edge',
          size === 'sm' ? 'inset-0.5' : 'inset-2',
        )}
      />
      {size !== 'sm' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-3 border border-plate-edge/60"
        />
      )}
      <span
        className={cn(
          'relative font-serif tracking-[0.08em]',
          size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-sm',
          premium ? 'text-accent' : 'text-foreground',
        )}
      >
        {initials}
      </span>
    </div>
  );
}

/**
 * The portrait plate. The monogram sits underneath the photograph so a portrait
 * that fails, or is still loading, never leaves an empty tile. Photographs that
 * arrive without a photograph of their own keep an equal-weight plate instead.
 */
export function MemberPortrait({
  member,
  sizes,
  className,
  monogramSize = 'md',
}: {
  member: PortraitSubject;
  sizes: string;
  className?: string;
  /** The plate is only as loud as it should be: bigger initials on bigger plates. */
  monogramSize?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // A portrait can finish failing before React hydrates, in which case onError
  // never fires and the browser's broken-image glyph would sit over the plate.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, [member.image]);

  const showImage = member.hasImage && Boolean(member.image) && !failed;
  const alt = [member.name, member.role, member.company && `at ${member.company}`]
    .filter(Boolean)
    .join(', ');

  return (
    <div className={cn('relative overflow-hidden bg-plate', className)}>
      <div className="absolute inset-0">
        <MemberMonogram
          initials={member.initials}
          premium={member.isPremium}
          size={monogramSize}
        />
      </div>
      {showImage && (
        <Image
          ref={imageRef}
          src={member.image}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized={!member.optimizable}
          onError={() => setFailed(true)}
          className="object-cover object-top"
        />
      )}
      {member.isPremium && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-accent" />
      )}
    </div>
  );
}

export type MemberSelectHandler = (member: DirectoryMember, trigger: HTMLElement) => void;

/**
 * The register entry opens the profile panel on a plain click, but stays a real
 * link: modifier clicks and middle clicks still open the member profile in a new
 * tab, which is how people actually triage a directory.
 */
function openOnPlainClick(
  event: MouseEvent<HTMLAnchorElement>,
  member: DirectoryMember,
  onSelect?: MemberSelectHandler,
) {
  if (!onSelect) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }
  event.preventDefault();
  onSelect(member, event.currentTarget);
}

/**
 * One entry in the portrait register. The caption is a fixed four-row grid
 * (name / role and company / location / availability) so every row of portraits
 * shares a baseline, whether or not a member has a role or availability flags.
 */
export function MemberCard({
  member,
  onSelect,
}: {
  member: DirectoryMember;
  onSelect?: MemberSelectHandler;
}) {
  const labels = availabilityLabels(member);

  return (
    <Link
      href={`/members/${member.linkTarget}`}
      onClick={(event) => openOnPlainClick(event, member, onSelect)}
      aria-haspopup="dialog"
      className="group block rounded-xs outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <MemberPortrait
        member={member}
        sizes="(min-width: 1024px) 272px, (min-width: 768px) 33vw, 45vw"
        className="aspect-[271/264]"
      />

      <div className="mt-3 grid grid-rows-[3rem_2.625rem_1.25rem_2.375rem] gap-y-1">
        <h3 className="line-clamp-2 font-serif text-lg leading-[1.24] text-foreground transition-colors group-hover:text-accent">
          {member.name}
        </h3>

        <div className="pt-0.5">
          {member.role && (
            <p className="line-clamp-1 text-[13.5px] leading-[1.4] text-ink-soft">{member.role}</p>
          )}
          {member.company && (
            <p className="line-clamp-1 text-[13.5px] font-medium leading-[1.45] text-foreground">
              {member.company}
            </p>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          {member.location && (
            <>
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{member.location}</span>
            </>
          )}
        </p>

        <div className="flex flex-wrap content-start gap-x-3 gap-y-1 pt-1">
          {labels.map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-[12.5px] text-accent">
              <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-accent" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

/**
 * The compact alternative to the register. Same data, one line per member, so a
 * visitor who already knows who they are looking for can scan names instead of
 * portraits.
 */
export function MemberRow({
  member,
  onSelect,
}: {
  member: DirectoryMember;
  onSelect?: MemberSelectHandler;
}) {
  const labels = availabilityLabels(member);

  return (
    <Link
      href={`/members/${member.linkTarget}`}
      onClick={(event) => openOnPlainClick(event, member, onSelect)}
      aria-haspopup="dialog"
      className="group flex items-center gap-4 border-b border-border py-4 outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-5"
    >
      <MemberPortrait member={member} sizes="56px" className="h-[70px] w-14 shrink-0" />

      <div className="min-w-0 flex-1 sm:w-[220px] sm:flex-none">
        <p className="truncate font-serif text-[17px] leading-tight text-foreground transition-colors group-hover:text-accent">
          {member.name}
        </p>
        {member.role && (
          <p className="mt-1 truncate text-[13px] text-ink-muted">{member.role}</p>
        )}
        {member.company && (
          <p className="truncate text-[13px] text-ink-muted lg:hidden">{member.company}</p>
        )}
      </div>

      <div className="hidden w-[180px] shrink-0 truncate text-[13.5px] font-medium text-foreground lg:block">
        {member.company}
      </div>
      <div className="hidden w-[140px] shrink-0 truncate text-[13px] text-ink-muted md:block">
        {member.location}
      </div>

      <div className="hidden flex-1 flex-wrap gap-x-3 gap-y-1 xl:flex">
        {labels.map((label) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-[12.5px] text-accent">
            <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-accent" />
            {label}
          </span>
        ))}
      </div>

      <ArrowUpRight
        className="size-4 shrink-0 text-ink-muted transition-colors group-hover:text-accent"
        aria-hidden
      />
    </Link>
  );
}

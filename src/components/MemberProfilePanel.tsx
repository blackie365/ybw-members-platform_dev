'use client';

import Link from 'next/link';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowUpRight, Linkedin, MapPin, X } from 'lucide-react';

import { MemberPortrait, type DirectoryMember } from '@/components/MemberCard';
import { availabilityLabels } from '@/features/members/display';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The member profile that slides in over the register. It is deliberately not a
 * modal dialog with a dimmed backdrop: the directory stays readable behind it,
 * so closing and opening the next person is a single step. Focus moves into the
 * panel on open, cycles inside it, and returns to the card that opened it.
 */
export function MemberProfilePanel({
  member,
  onClose,
}: {
  member: DirectoryMember | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!member) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [member]);

  if (!member) return null;

  const labels = availabilityLabels(member);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-panel-name"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="animate-fade-in fixed inset-y-0 right-0 z-50 flex w-full max-w-[432px] flex-col border-l border-rule-strong bg-card outline-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.17em] text-ink-muted">
          Member profile
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="flex size-8 items-center justify-center text-ink-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-6">
          <MemberPortrait
            member={member}
            sizes="384px"
            monogramSize="lg"
            className="aspect-[271/264]"
          />
        </div>

        <div className="px-6 pb-9 pt-5">
          <h2 id="member-panel-name" className="font-serif text-[26px] leading-[1.12] text-foreground">
            {member.name}
          </h2>
          {member.role && (
            <p className="mt-2 text-sm leading-[1.45] text-ink-soft">{member.role}</p>
          )}
          {member.company && (
            <p className="text-sm font-medium leading-[1.45] text-foreground">{member.company}</p>
          )}
          {member.location && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
              <MapPin className="size-3 shrink-0" aria-hidden />
              {member.location}
            </p>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.17em] text-ink-muted">
              Availability
            </p>
            {labels.length > 0 ? (
              <ul className="mt-2.5 space-y-2">
                {labels.map((label) => (
                  <li key={label} className="flex items-center gap-2 text-[13.5px] text-foreground">
                    <span aria-hidden className="size-[5px] rounded-full bg-accent" />
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 text-[13.5px] text-ink-muted">Not listed</p>
            )}
          </div>

          {member.bio && (
            <div className="mt-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.17em] text-ink-muted">Bio</p>
              <p className="mt-2.5 text-[13.5px] leading-[1.65] text-ink-soft">{member.bio}</p>
            </div>
          )}

          {(member.website || member.linkedin) && (
            <div className="mt-6 space-y-2 border-t border-border pt-5">
              {member.website && (
                <a
                  href={member.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 text-[13.5px] text-ink-soft transition-colors hover:text-accent"
                >
                  <span className="text-ink-muted">Website</span>
                  <span className="inline-flex items-center gap-1.5">
                    {member.website.replace(/^https?:\/\/(www\.)?/, '')}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </span>
                </a>
              )}
              {member.linkedin && (
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-6 text-[13.5px] text-ink-soft transition-colors hover:text-accent"
                >
                  <span className="text-ink-muted">LinkedIn</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Linkedin className="size-3.5" aria-hidden />
                    {member.name}
                  </span>
                </a>
              )}
            </div>
          )}

          <Link
            href={`/members/${member.linkTarget}`}
            className="mt-7 flex h-11 items-center justify-center bg-accent px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:bg-foreground"
          >
            Open member profile
          </Link>
        </div>
      </div>
    </div>
  );
}

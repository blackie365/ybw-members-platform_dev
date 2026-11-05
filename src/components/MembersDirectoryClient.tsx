'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import {
  MemberCard,
  MemberPortrait,
  MemberRow,
  type DirectoryMember,
  type MemberSelectHandler,
} from '@/components/MemberCard';
import { AVAILABILITY_FLAGS, type AvailabilityKey } from '@/features/members/display';
import { MemberProfilePanel } from '@/components/MemberProfilePanel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 40;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const EYEBROW = 'text-[11px] font-medium uppercase tracking-[0.17em] text-ink-muted';

type SortOrder = 'az' | 'za' | 'location';
type View = 'grid' | 'list';

const NO_AVAILABILITY: Record<AvailabilityKey, boolean> = {
  openToMentoring: false,
  seekingMentorship: false,
  openToBoardRoles: false,
};

function matchesQuery(member: DirectoryMember, term: string): boolean {
  if (!term) return true;
  return [member.name, member.role, member.company, member.location, member.bio]
    .join(' ')
    .toLowerCase()
    .includes(term);
}

function initialOf(member: DirectoryMember): string {
  return member.name.trim().charAt(0).toUpperCase();
}

function sortMembers(members: DirectoryMember[], order: SortOrder): DirectoryMember[] {
  const sorted = [...members];
  sorted.sort((a, b) => {
    if (order === 'location') {
      return a.locationFacet.localeCompare(b.locationFacet, 'en') || a.name.localeCompare(b.name, 'en');
    }
    return order === 'za' ? b.name.localeCompare(a.name, 'en') : a.name.localeCompare(b.name, 'en');
  });
  return sorted;
}

export function MembersDirectoryClient({ initialMembers }: { initialMembers: DirectoryMember[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('all');
  const [letter, setLetter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('az');
  const [view, setView] = useState<View>('grid');
  const [availability, setAvailability] = useState(NO_AVAILABILITY);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [initialOpen, setInitialOpen] = useState(false);

  const newestTrackRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  // Every filter change rewinds the list, otherwise a narrower result set can
  // be left scrolled past its own end.
  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of initialMembers) {
      if (!member.locationFacet) continue;
      counts.set(member.locationFacet, (counts.get(member.locationFacet) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));
  }, [initialMembers]);

  const letterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of initialMembers) {
      const initial = initialOf(member);
      if (initial) counts.set(initial, (counts.get(initial) || 0) + 1);
    }
    return counts;
  }, [initialMembers]);

  /**
   * The strip is built only from records that carry a join date. There is no
   * "featured" flag, so inventing an order would make the label untrue.
   */
  const newestMembers = useMemo(() => {
    return initialMembers
      .filter((member) => Boolean(member.joinedAt))
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
      .slice(0, 6);
  }, [initialMembers]);

  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const result = initialMembers.filter((member) => {
      if (location !== 'all' && member.locationFacet !== location) return false;
      if (letter && initialOf(member) !== letter) return false;
      if (availability.openToMentoring && !member.openToMentoring) return false;
      if (availability.seekingMentorship && !member.seekingMentorship) return false;
      if (availability.openToBoardRoles && !member.openToBoardRoles) return false;
      return matchesQuery(member, term);
    });

    return sortMembers(result, sortOrder);
  }, [initialMembers, searchTerm, location, letter, availability, sortOrder]);

  /**
   * Counts beside each checkbox describe the set the other controls have already
   * narrowed to, so the numbers never promise members a filter cannot show.
   */
  const availabilityCounts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = initialMembers.filter((member) => {
      if (location !== 'all' && member.locationFacet !== location) return false;
      if (letter && initialOf(member) !== letter) return false;
      return matchesQuery(member, term);
    });

    return {
      openToMentoring: base.filter((member) => member.openToMentoring).length,
      seekingMentorship: base.filter((member) => member.seekingMentorship).length,
      openToBoardRoles: base.filter((member) => member.openToBoardRoles).length,
    } satisfies Record<AvailabilityKey, number>;
  }, [initialMembers, searchTerm, location, letter]);

  const displayedMembers = filteredMembers.slice(0, visibleCount);
  const remainingCount = Math.max(filteredMembers.length - visibleCount, 0);

  const activeAvailability = AVAILABILITY_FLAGS.filter((flag) => availability[flag.key]);
  const activeFilterCount = availabilityCountActive(availability) + (location !== 'all' ? 1 : 0);
  const hasActiveFilters = searchTerm !== '' || activeFilterCount > 0 || Boolean(letter);

  const clearAllFilters = () => {
    setSearchTerm('');
    setLocation('all');
    setLetter(null);
    setAvailability(NO_AVAILABILITY);
    resetPaging();
  };

  const toggleAvailability = (key: AvailabilityKey) => {
    setAvailability((prev) => ({ ...prev, [key]: !prev[key] }));
    resetPaging();
  };

  const handleSelect: MemberSelectHandler = (member, trigger) => {
    lastTriggerRef.current = trigger;
    setSelectedMember(member);
  };

  const closePanel = () => {
    setSelectedMember(null);
    // The card that opened the panel still exists, so hand focus back to it.
    requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const scrollNewest = (direction: 1 | -1) => {
    newestTrackRef.current?.scrollBy({ left: direction * 280, behavior: 'smooth' });
  };

  const hasResults = filteredMembers.length > 0;

  return (
    <div className="bg-background">
      <section className="mx-auto w-full max-w-[1180px] px-4 pt-11 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h1 className="font-serif text-[38px] leading-none tracking-[-0.01em] text-foreground sm:text-[50px]">
            Member directory
          </h1>
          {initialMembers.length > 0 && (
            <dl className="flex items-center gap-7 pb-1">
              <div className="flex items-baseline gap-2">
                <dd className="font-serif text-[22px] leading-none text-foreground">
                  {initialMembers.length}
                </dd>
                <dt className="text-[12.5px] text-ink-muted">members</dt>
              </div>
              <div className="flex items-baseline gap-2 border-l border-border pl-7">
                <dd className="font-serif text-[22px] leading-none text-foreground">
                  {locationOptions.length}
                </dd>
                <dt className="text-[12.5px] text-ink-muted">locations</dt>
              </div>
            </dl>
          )}
        </div>

        {newestMembers.length > 0 && (
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
            <p className={cn(EYEBROW, 'shrink-0')}>Newest members</p>
            <div
              ref={newestTrackRef}
              className="scrollbar-thin grid grid-cols-2 gap-x-4 gap-y-2 lg:flex lg:flex-1 lg:items-center lg:gap-x-6 lg:overflow-x-auto"
            >
              {newestMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMember(member)}
                  className="group flex min-w-0 items-center gap-2.5 text-left outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:shrink-0"
                >
                  <MemberPortrait member={member} sizes="36px" className="size-9 shrink-0" />
                  <span className="truncate text-[12.5px] text-ink-soft transition-colors group-hover:text-accent">
                    {member.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="hidden shrink-0 items-center gap-1 lg:flex">
              <button
                type="button"
                onClick={() => scrollNewest(-1)}
                aria-label="Scroll newest members left"
                className="flex size-7 items-center justify-center border border-rule-strong bg-card text-ink-muted transition-colors hover:border-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => scrollNewest(1)}
                aria-label="Scroll newest members right"
                className="flex size-7 items-center justify-center border border-rule-strong bg-card text-ink-muted transition-colors hover:border-foreground hover:text-foreground"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-4 pt-7 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-row lg:items-end">
          <div className="col-span-2 lg:flex-1">
            <label htmlFor="directory-search" className={cn(EYEBROW, 'block')}>
              Search members
            </label>
            <div className="relative mt-1.5">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                id="directory-search"
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  resetPaging();
                }}
                placeholder="Name, company or keyword"
                className="h-11 w-full border border-rule-strong bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-ink-muted focus:border-foreground focus:outline-hidden"
              />
            </div>
          </div>

          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="col-span-2">
              <span className={cn(EYEBROW, 'block')}>Refine</span>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mt-1.5 flex h-11 items-center gap-2 border border-rule-strong bg-card px-4 text-sm text-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <SlidersHorizontal className="size-4 text-ink-muted" aria-hidden />
                  {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
                </button>
              </PopoverTrigger>
            </div>
            <PopoverContent
              align="start"
              sideOffset={8}
              aria-label="Filter members"
              className="w-[330px] rounded-none border-rule-strong p-4 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.5)]"
            >
              <div className="flex items-center justify-between">
                <p className={EYEBROW}>Filters</p>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                  className="flex size-7 items-center justify-center text-ink-muted transition-colors hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mt-3">
                <label htmlFor="directory-location" className="block text-[13px] font-medium text-ink-soft">
                  Location
                </label>
                <select
                  id="directory-location"
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    resetPaging();
                  }}
                  className="mt-1.5 h-10 w-full border border-rule-strong bg-card px-3 text-[13.5px] text-foreground focus:border-foreground focus:outline-hidden"
                >
                  <option value="all">All locations</option>
                  {locationOptions.map(([place, count]) => (
                    <option key={place} value={place}>
                      {place} ({count})
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="mt-4">
                <legend className="text-[13px] font-medium text-ink-soft">Availability</legend>
                <div className="mt-2 space-y-2.5">
                  {AVAILABILITY_FLAGS.map((flag) => (
                    <label
                      key={flag.key}
                      className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink-soft"
                    >
                      <input
                        type="checkbox"
                        checked={availability[flag.key]}
                        onChange={() => toggleAvailability(flag.key)}
                        className="size-4 shrink-0 accent-accent"
                      />
                      <span className="flex-1">{flag.label}</span>
                      <span className="text-[12.5px] text-ink-muted">
                        {availabilityCounts[flag.key]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 w-full border-t border-border pt-3 text-left text-[13px] text-accent transition-colors hover:text-foreground"
              >
                Clear all filters
              </button>
            </PopoverContent>
          </Popover>

          <div className="lg:w-[150px]">
            <label htmlFor="directory-sort" className={cn(EYEBROW, 'block')}>
              Name order
            </label>
            <div className="relative mt-1.5">
              <select
                id="directory-sort"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                className="h-11 w-full appearance-none border border-rule-strong bg-card pl-3 pr-9 text-sm text-foreground focus:border-foreground focus:outline-hidden"
              >
                <option value="az">A–Z</option>
                <option value="za">Z–A</option>
                <option value="location">Location</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
            </div>
          </div>

          <div>
            <span className={cn(EYEBROW, 'block')}>View</span>
            <div className="mt-1.5 flex h-11 items-center border border-rule-strong bg-card p-1">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                className={cn(
                  'flex size-9 items-center justify-center transition-colors',
                  view === 'grid'
                    ? 'bg-foreground text-background'
                    : 'text-ink-muted hover:text-foreground',
                )}
              >
                <LayoutGrid className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="List view"
                aria-pressed={view === 'list'}
                className={cn(
                  'flex size-9 items-center justify-center transition-colors',
                  view === 'list'
                    ? 'bg-foreground text-background'
                    : 'text-ink-muted hover:text-foreground',
                )}
              >
                <List className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* The alphabet is the primary way into the list, so it stays on the page
            at desktop widths instead of hiding inside a filter panel. */}
        <div className="mt-6 hidden items-center gap-4 border-y border-border py-2.5 lg:flex">
          <button
            type="button"
            onClick={() => {
              setLetter(null);
              resetPaging();
            }}
            className={cn(
              'shrink-0 text-[12.5px] font-medium uppercase tracking-[0.13em] transition-colors',
              letter ? 'text-accent hover:text-foreground' : 'text-foreground',
            )}
          >
            All names
          </button>
          <span aria-hidden className="h-4 w-px bg-border" />
          <div className="flex flex-1 items-center justify-between">
            {ALPHABET.map((initial) => {
              const count = letterCounts.get(initial) || 0;
              const active = letter === initial;
              return (
                <button
                  key={initial}
                  type="button"
                  disabled={count === 0}
                  aria-pressed={active}
                  aria-label={`Names beginning ${initial}`}
                  onClick={() => {
                    setLetter(active ? null : initial);
                    resetPaging();
                  }}
                  className={cn(
                    'flex size-6 items-center justify-center border-b text-[13px] transition-colors',
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : count === 0
                        ? 'cursor-default border-transparent text-border'
                        : 'border-transparent text-ink-soft hover:text-accent',
                  )}
                >
                  {initial}
                </button>
              );
            })}
          </div>
        </div>

        {/* Below the alphabet breakpoint the same letters live behind an explicit
            control rather than an unmarked horizontal scroller. */}
        <Popover open={initialOpen} onOpenChange={setInitialOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="mt-6 flex h-11 w-full items-center justify-between border border-rule-strong bg-card px-3.5 text-sm lg:hidden"
            >
              <span className="text-ink-muted">Name initial</span>
              <span className="flex items-center gap-2 font-medium text-foreground">
                {letter ?? 'All names'}
                <ChevronDown className="size-4 text-ink-muted" aria-hidden />
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label="Filter by name initial"
            className="w-[calc(100vw-2rem)] max-w-[440px] rounded-none border-rule-strong p-3"
          >
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  setLetter(null);
                  resetPaging();
                  setInitialOpen(false);
                }}
                className={cn(
                  'mb-1 mr-1 h-8 px-3 text-[12px] uppercase tracking-[0.12em]',
                  letter ? 'border border-rule-strong text-accent' : 'bg-foreground text-background',
                )}
              >
                All
              </button>
              {ALPHABET.map((initial) => {
                const count = letterCounts.get(initial) || 0;
                const active = letter === initial;
                return (
                  <button
                    key={initial}
                    type="button"
                    disabled={count === 0}
                    aria-pressed={active}
                    onClick={() => {
                      setLetter(active ? null : initial);
                      resetPaging();
                      setInitialOpen(false);
                    }}
                    className={cn(
                      'flex size-8 items-center justify-center text-[13px]',
                      active
                        ? 'bg-foreground text-background'
                        : count === 0
                          ? 'cursor-default text-border'
                          : 'border border-border text-ink-soft hover:text-accent',
                    )}
                  >
                    {initial}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] text-ink-muted">
              {hasResults
                ? `Showing ${displayedMembers.length} of ${filteredMembers.length} members`
                : 'No members'}
            </p>

            {location !== 'all' && (
              <FilterChip
                label={location}
                onClear={() => {
                  setLocation('all');
                  resetPaging();
                }}
              />
            )}
            {activeAvailability.map((flag) => (
              <FilterChip
                key={flag.key}
                label={flag.label}
                onClear={() => toggleAvailability(flag.key)}
              />
            ))}
            {letter && (
              <FilterChip
                label={`Names ${letter}`}
                onClear={() => {
                  setLetter(null);
                  resetPaging();
                }}
              />
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[13px] text-accent transition-colors hover:text-foreground"
            >
              Clear all filters
            </button>
          )}
        </div>

        <h2 className="sr-only">Members</h2>

        {!hasResults ? (
          <div className="mt-5 border border-dashed border-rule-strong px-6 py-16 text-center">
            <p className="font-serif text-lg text-foreground">No members match these filters.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Try a different name, company or place, or widen the availability filters.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-5 inline-flex h-10 items-center border border-foreground px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              Clear all filters
            </button>
          </div>
        ) : view === 'grid' ? (
          <ul className="mt-5 grid grid-cols-2 gap-x-7 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
            {displayedMembers.map((member) => (
              <li key={member.id}>
                <MemberCard member={member} onSelect={handleSelect} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-5 border-t border-border">
            {displayedMembers.map((member) => (
              <li key={member.id}>
                <MemberRow member={member} onSelect={handleSelect} />
              </li>
            ))}
          </ul>
        )}

        {remainingCount > 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 border-t border-border pt-9">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="h-11 border border-foreground px-8 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              Load more members
            </button>
            <p className="text-[12.5px] text-ink-muted">
              {remainingCount} more {remainingCount === 1 ? 'member' : 'members'}
            </p>
          </div>
        )}
      </section>

      <MemberProfilePanel member={selectedMember} onClose={closePanel} />
    </div>
  );
}

function availabilityCountActive(availability: Record<AvailabilityKey, boolean>): number {
  return AVAILABILITY_FLAGS.filter((flag) => availability[flag.key]).length;
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1.5 border border-rule-strong bg-card px-2.5 py-1 text-[12.5px] text-ink-soft transition-colors hover:border-accent hover:text-accent"
    >
      {label}
      <X className="size-3 text-ink-muted" aria-hidden />
      <span className="sr-only">Remove filter</span>
    </button>
  );
}

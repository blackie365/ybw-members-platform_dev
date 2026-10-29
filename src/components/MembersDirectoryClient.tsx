'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpRight,
  ChevronDown,
  LayoutGrid,
  List,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';
import { MemberCard, MemberMonogram, type DirectoryMember } from '@/components/MemberCard';

const PAGE_SIZE = 18;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const NO_FILTERS = { mentoring: false, seeking: false, board: false };

type SortOrder = 'asc' | 'desc';
type View = 'grid' | 'list';

export function MembersDirectoryClient({ initialMembers }: { initialMembers: DirectoryMember[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('all');
  const [letter, setLetter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [view, setView] = useState<View>('grid');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Every filter change rewinds the list, otherwise a narrower result set can
  // be left scrolled past its own end.
  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of initialMembers) {
      if (!member.locationFacet) continue;
      counts.set(member.locationFacet, (counts.get(member.locationFacet) || 0) + 1);
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'),
    );
  }, [initialMembers]);

  const letterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of initialMembers) {
      const initial = member.name.trim().charAt(0).toUpperCase();
      if (initial) counts.set(initial, (counts.get(initial) || 0) + 1);
    }
    return counts;
  }, [initialMembers]);

  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const result = initialMembers.filter((member) => {
      if (location !== 'all' && member.locationFacet !== location) return false;
      if (letter && member.name.trim().charAt(0).toUpperCase() !== letter) return false;
      if (filters.mentoring && !member.openToMentoring) return false;
      if (filters.seeking && !member.seekingMentorship) return false;
      if (filters.board && !member.openToBoardRoles) return false;

      if (term) {
        const haystack = [
          member.name,
          member.role,
          member.company,
          member.location,
          member.bio,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });

    return result.sort((a, b) =>
      sortOrder === 'asc'
        ? a.name.localeCompare(b.name, 'en')
        : b.name.localeCompare(a.name, 'en'),
    );
  }, [initialMembers, searchTerm, location, letter, filters, sortOrder]);

  const displayedMembers = filteredMembers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMembers.length;
  const hasActiveFilters =
    Boolean(searchTerm) || location !== 'all' || Boolean(letter) || filters.mentoring || filters.seeking || filters.board;

  const clearAllFilters = () => {
    setSearchTerm('');
    setLocation('all');
    setLetter(null);
    setFilters(NO_FILTERS);
    resetPaging();
  };

  const chipClass = (active: boolean) =>
    `inline-flex items-center border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
      active
        ? 'border-foreground bg-foreground text-background'
        : 'border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground'
    }`;

  return (
    <div>
      {/* Toolbar */}
      <div className="border border-border bg-card">
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-stretch">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name="search"
              id="directory-search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                resetPaging();
              }}
              placeholder="Search by name, company or expertise…"
              className="w-full border border-border bg-background py-3.5 pl-11 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  resetPaging();
                }}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          {/* Location */}
          <div className="relative lg:w-56">
            <MapPin
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <select
              aria-label="Filter by location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                resetPaging();
              }}
              className="w-full appearance-none border border-border bg-background py-3.5 pl-11 pr-10 text-sm text-foreground focus:border-foreground focus:outline-none"
            >
              <option value="all">All locations</option>
              {locationOptions.map(([place, count]) => (
                <option key={place} value={place}>
                  {place} ({count})
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>

          {/* Sort */}
          <div className="flex items-stretch border border-border">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center gap-2 px-4 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              aria-label={sortOrder === 'asc' ? 'Sorted A to Z, switch to Z to A' : 'Sorted Z to A, switch to A to Z'}
            >
              {sortOrder === 'asc' ? (
                <ArrowDownAZ className="h-4 w-4" aria-hidden />
              ) : (
                <ArrowUpAZ className="h-4 w-4" aria-hidden />
              )}
              <span className="uppercase tracking-[0.12em] text-[11px]">
                {sortOrder === 'asc' ? 'A–Z' : 'Z–A'}
              </span>
            </button>
            <span aria-hidden className="w-px bg-border" />
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              className={`px-3.5 transition-colors ${
                view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={`px-3.5 transition-colors ${
                view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Refinements */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
          <span className="mr-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Refine</span>
          <button
            type="button"
            aria-pressed={filters.mentoring}
            onClick={() => {
              setFilters((prev) => ({ ...prev, mentoring: !prev.mentoring }));
              resetPaging();
            }}
            className={chipClass(filters.mentoring)}
          >
            Open to coaching
          </button>
          <button
            type="button"
            aria-pressed={filters.seeking}
            onClick={() => {
              setFilters((prev) => ({ ...prev, seeking: !prev.seeking }));
              resetPaging();
            }}
            className={chipClass(filters.seeking)}
          >
            Seeking a coach
          </button>
          <button
            type="button"
            aria-pressed={filters.board}
            onClick={() => {
              setFilters((prev) => ({ ...prev, board: !prev.board }));
              resetPaging();
            }}
            className={chipClass(filters.board)}
          >
            Board roles (NED)
          </button>
        </div>
      </div>

      {/* A–Z */}
      <div className="mt-8 flex flex-wrap items-center gap-1">
        <span className="mr-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Browse</span>
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
              }}
              className={`h-8 w-8 text-xs font-medium transition-colors ${
                active
                  ? 'bg-accent text-white'
                  : count === 0
                    ? 'cursor-default text-border'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {initial}
            </button>
          );
        })}
      </div>

      {/* Result count */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{displayedMembers.length}</span> of{' '}
          <span className="font-medium text-foreground">{filteredMembers.length}</span>{' '}
          {filteredMembers.length === 1 ? 'member' : 'members'}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent underline-offset-4 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Results */}
      {displayedMembers.length === 0 ? (
        <div className="py-24 text-center">
          <Users className="mx-auto mb-6 h-10 w-10 text-muted-foreground/40" aria-hidden />
          <h3 className="mb-3 font-serif text-2xl font-normal text-foreground">No members found</h3>
          <p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground">
            {searchTerm
              ? `We couldn't find anyone matching “${searchTerm}”. Try a different name, company or place.`
              : 'Try widening your filters to see more of the network.'}
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center border border-foreground bg-foreground px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-background transition-colors hover:bg-background hover:text-foreground"
          >
            Clear all filters
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <ul className="mt-4 border-t border-border">
          {displayedMembers.map((member) => (
            <li key={member.id}>
              <Link
                href={`/members/${member.linkTarget}`}
                className="group flex items-center gap-5 border-b border-border px-1 py-4 transition-colors hover:bg-secondary/60"
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden bg-secondary">
                  {member.hasImage && member.image ? (
                    <Image
                      src={member.image}
                      alt=""
                      fill
                      sizes="48px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <MemberMonogram initials={member.initials} premium={member.isPremium} compact />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg text-foreground transition-colors group-hover:text-accent">
                    {member.name}
                  </span>
                  {(member.role || member.company) && (
                    <span className="block truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {[member.role, member.company].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span className="hidden w-44 shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted-foreground md:block">
                  {member.location}
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Paging */}
      {hasMore && (
        <div className="mt-16 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="inline-flex items-center justify-center border border-foreground bg-foreground px-8 py-4 text-[11px] font-medium uppercase tracking-[0.14em] text-background transition-colors hover:bg-background hover:text-foreground"
          >
            Load more members
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            {filteredMembers.length - visibleCount} more{' '}
            {filteredMembers.length - visibleCount === 1 ? 'member' : 'members'} available
          </p>
        </div>
      )}
    </div>
  );
}

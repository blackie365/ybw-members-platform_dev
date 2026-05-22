"use client";

import { useState, useMemo } from 'react';
import { MemberCard } from '@/components/MemberCard';
import { Search, ArrowDownAZ, ArrowUpAZ, Users } from 'lucide-react';

export function MembersDirectoryClient({ initialMembers }: { initialMembers: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [visibleCount, setVisibleCount] = useState(16);
  
  const [filterMentoring, setFilterMentoring] = useState(false);
  const [filterSeeking, setFilterSeeking] = useState(false);
  const [filterBoard, setFilterBoard] = useState(false);

  const filteredAndSortedMembers = useMemo(() => {
    let result = initialMembers.filter((member) => {
      const term = searchTerm.toLowerCase();
      const firstName = (member.firstName || "").toLowerCase();
      const lastName = (member.lastName || "").toLowerCase();
      const company = (member.companyName || '').toLowerCase();
      const bio = (member.bio || '').toLowerCase();
      const jobTitle = (member.jobTitle || '').toLowerCase();

      const matchesSearch = firstName.includes(term) ||
        lastName.includes(term) ||
        company.includes(term) ||
        jobTitle.includes(term) ||
        bio.includes(term);

      if (!matchesSearch) return false;

      if (filterMentoring && !member.openToMentoring) return false;
      if (filterSeeking && !member.seekingMentorship) return false;
      if (filterBoard && !member.openToBoardRoles) return false;

      return true;
    });

    return result.sort((a, b) => {
      const nameA = (a.firstName || '').toLowerCase();
      const nameB = (b.firstName || '').toLowerCase();
      
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });
  }, [initialMembers, searchTerm, sortOrder, filterMentoring, filterSeeking, filterBoard]);

  const displayedMembers = useMemo(() => {
    return filteredAndSortedMembers.slice(0, visibleCount);
  }, [filteredAndSortedMembers, visibleCount]);

  const hasMore = visibleCount < filteredAndSortedMembers.length;

  const loadMore = () => {
    setVisibleCount(prev => prev + 16);
  };

  return (
    <div>
      {/* Controls Section - v0 inspired layout */}
      <div className="flex flex-col gap-4 mb-12">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-2xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(16);
              }}
              className="block w-full rounded-xl border-0 py-4 pl-11 pr-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6 bg-card transition-shadow"
              placeholder="Search by name, company, or expertise..."
            />
          </div>

          {/* Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="inline-flex items-center gap-x-2 rounded-xl bg-card px-4 py-4 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-secondary transition-colors"
          >
            {sortOrder === 'asc' ? (
              <>
                <ArrowDownAZ className="-ml-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Sort A-Z
              </>
            ) : (
              <>
                <ArrowUpAZ className="-ml-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Sort Z-A
              </>
            )}
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setFilterMentoring(!filterMentoring);
              setVisibleCount(16);
            }}
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors border ${
              filterMentoring
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80 border-transparent'
            }`}
          >
            Open to Coaching
          </button>
          <button
            onClick={() => {
              setFilterSeeking(!filterSeeking);
              setVisibleCount(16);
            }}
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors border ${
              filterSeeking
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80 border-transparent'
            }`}
          >
            Seeking a Coach
          </button>
          <button
            onClick={() => {
              setFilterBoard(!filterBoard);
              setVisibleCount(16);
            }}
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors border ${
              filterBoard
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80 border-transparent'
            }`}
          >
            Board Roles (NED)
          </button>
        </div>
      </div>

      {/* Results Stats */}
      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <p>Showing <span className="font-semibold text-foreground">{displayedMembers.length}</span> of {filteredAndSortedMembers.length} members</p>
        {(filterMentoring || filterSeeking || filterBoard || searchTerm) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterMentoring(false);
              setFilterSeeking(false);
              setFilterBoard(false);
              setVisibleCount(16);
            }}
            className="text-xs font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayedMembers.length > 0 ? (
          displayedMembers.map((member: any, index: number) => (
            <MemberCard key={member.id || member.email || member.slug || index} member={member} />
          ))
        ) : (
          <div className="col-span-full py-24 text-center rounded-2xl border-2 border-dashed border-border bg-card/50">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-serif font-medium text-foreground mb-2">No members found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto px-4">
              {searchTerm 
                ? `We couldn't find anyone matching "${searchTerm}". Try adjusting your search or filters.`
                : 'Try adjusting your filters to see more members.'
              }
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterMentoring(false);
                setFilterSeeking(false);
                setFilterBoard(false);
                setVisibleCount(16);
              }}
              className="inline-flex items-center px-6 py-2.5 text-sm font-medium text-accent-foreground bg-accent hover:bg-accent/90 rounded-full transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* See More Button */}
      {hasMore && (
        <div className="mt-16 text-center">
          <button
            onClick={loadMore}
            className="inline-flex items-center justify-center px-10 py-3.5 bg-accent text-accent-foreground font-medium uppercase tracking-wider text-xs rounded-full hover:bg-accent/90 transition-all duration-300 shadow-md hover:shadow-lg active:scale-95"
          >
            See More Members
          </button>
        </div>
      )}
    </div>
  );
}


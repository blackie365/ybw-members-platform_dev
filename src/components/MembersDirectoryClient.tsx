"use client";

import { useState, useMemo } from 'react';
import { MemberCard } from '@/components/MemberCard';
import { Search, ArrowDownAZ, ArrowUpAZ, Users, X } from 'lucide-react';

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
  const hasActiveFilters = filterMentoring || filterSeeking || filterBoard || searchTerm;

  const loadMore = () => {
    setVisibleCount(prev => prev + 16);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterMentoring(false);
    setFilterSeeking(false);
    setFilterBoard(false);
    setVisibleCount(16);
  };

  return (
    <div>
      {/* Controls Section */}
      <div className="mb-12 space-y-6">
        {/* Search and Sort Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
              className="block w-full border border-border bg-background py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none transition-colors text-sm"
              placeholder="Search by name, company, or expertise..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="inline-flex items-center justify-center gap-x-2 bg-background px-6 py-4 text-sm font-medium text-foreground border border-border hover:bg-secondary transition-colors"
          >
            {sortOrder === 'asc' ? (
              <>
                <ArrowDownAZ className="h-4 w-4" aria-hidden="true" />
                <span>A-Z</span>
              </>
            ) : (
              <>
                <ArrowUpAZ className="h-4 w-4" aria-hidden="true" />
                <span>Z-A</span>
              </>
            )}
          </button>
        </div>

        {/* Filter Section */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground mr-1">
            Filter:
          </span>
          <button
            onClick={() => {
              setFilterMentoring(!filterMentoring);
              setVisibleCount(16);
            }}
            className={`inline-flex items-center px-4 py-2.5 text-sm font-medium transition-colors border ${
              filterMentoring
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-border hover:border-foreground'
            }`}
          >
            Open to Coaching
          </button>
          <button
            onClick={() => {
              setFilterSeeking(!filterSeeking);
              setVisibleCount(16);
            }}
            className={`inline-flex items-center px-4 py-2.5 text-sm font-medium transition-colors border ${
              filterSeeking
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-border hover:border-foreground'
            }`}
          >
            Seeking a Coach
          </button>
          <button
            onClick={() => {
              setFilterBoard(!filterBoard);
              setVisibleCount(16);
            }}
            className={`inline-flex items-center px-4 py-2.5 text-sm font-medium transition-colors border ${
              filterBoard
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-border hover:border-foreground'
            }`}
          >
            Board Roles (NED)
          </button>
        </div>
      </div>

      {/* Results Stats */}
      <div className="mb-10 flex items-center justify-between border-b border-border pb-6">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{displayedMembers.length}</span> of{' '}
          <span className="font-medium text-foreground">{filteredAndSortedMembers.length}</span> members
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border border-border">
        {displayedMembers.length > 0 ? (
          displayedMembers.map((member: any, index: number) => (
            <MemberCard key={member.id || member.email || member.slug || index} member={member} />
          ))
        ) : (
          <div className="col-span-full bg-background py-24 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-6" aria-hidden="true" />
            <h3 className="font-serif text-2xl font-normal text-foreground mb-3">No members found</h3>
            <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
              {searchTerm 
                ? `We couldn't find anyone matching "${searchTerm}". Try adjusting your search or filters.`
                : 'Try adjusting your filters to see more members.'
              }
            </p>
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center px-6 py-3 text-sm font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-16 text-center">
          <button
            onClick={loadMore}
            className="inline-flex items-center justify-center px-8 py-4 border border-foreground bg-foreground text-background font-medium text-sm hover:bg-background hover:text-foreground transition-all duration-200"
          >
            Load More Members
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            {filteredAndSortedMembers.length - visibleCount} more members available
          </p>
        </div>
      )}
    </div>
  );
}

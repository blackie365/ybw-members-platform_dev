"use client";

import { useState, useMemo } from 'react';
import { MemberCard } from '@/components/MemberCard';
import { Search, ArrowDownAZ, ArrowUpAZ, Users } from 'lucide-react';

export function MembersDirectoryClient({ initialMembers }: { initialMembers: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [filterMentoring, setFilterMentoring] = useState(false);
  const [filterSeeking, setFilterSeeking] = useState(false);
  const [filterBoard, setFilterBoard] = useState(false);

  const filteredAndSortedMembers = useMemo(() => {
    let result = initialMembers.filter((member) => {
      const term = searchTerm.toLowerCase();
      const firstName = (member.firstName || member['First Name'] || '').toLowerCase();
      const lastName = (member.lastName || member['Last Name'] || '').toLowerCase();
      const company = (member.companyName || '').toLowerCase();
      const bio = (member.bio || member['Bio'] || '').toLowerCase();
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
      const nameA = (a.firstName || a['First Name'] || '').toLowerCase();
      const nameB = (b.firstName || b['First Name'] || '').toLowerCase();
      
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });
  }, [initialMembers, searchTerm, sortOrder, filterMentoring, filterSeeking, filterBoard]);

  return (
    <div>
      {/* Controls Section */}
      <div className="flex flex-col gap-6 mb-12">
        {/* Search and Sort Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full border border-input bg-card py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
              placeholder="Search by name, company, or expertise..."
            />
          </div>

          {/* Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="inline-flex items-center justify-center gap-x-2 bg-card px-5 py-3.5 text-sm font-medium text-foreground border border-input hover:border-accent/40 hover:bg-secondary transition-colors"
          >
            {sortOrder === 'asc' ? (
              <>
                <ArrowDownAZ className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span>A-Z</span>
              </>
            ) : (
              <>
                <ArrowUpAZ className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span>Z-A</span>
              </>
            )}
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground self-center mr-2">
            Filter by:
          </span>
          <button
            onClick={() => setFilterMentoring(!filterMentoring)}
            className={`inline-flex items-center px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors border ${
              filterMentoring
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card text-muted-foreground border-border hover:border-accent/40'
            }`}
          >
            Open to Coaching
          </button>
          <button
            onClick={() => setFilterSeeking(!filterSeeking)}
            className={`inline-flex items-center px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors border ${
              filterSeeking
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card text-muted-foreground border-border hover:border-accent/40'
            }`}
          >
            Seeking a Coach
          </button>
          <button
            onClick={() => setFilterBoard(!filterBoard)}
            className={`inline-flex items-center px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors border ${
              filterBoard
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card text-muted-foreground border-border hover:border-accent/40'
            }`}
          >
            Board Roles (NED)
          </button>
        </div>
      </div>

      {/* Results Stats */}
      <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredAndSortedMembers.length}</span> of {initialMembers.length} members
        </p>
        {(filterMentoring || filterSeeking || filterBoard || searchTerm) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterMentoring(false);
              setFilterSeeking(false);
              setFilterBoard(false);
            }}
            className="text-xs font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAndSortedMembers.length > 0 ? (
          filteredAndSortedMembers.map((member: any, index: number) => (
            <MemberCard key={member.id || member.email || member.slug || index} member={member} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border bg-card">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <h3 className="font-serif text-xl font-medium text-foreground mb-2">No members found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
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
              }}
              className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-accent-foreground bg-accent hover:bg-accent/90 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

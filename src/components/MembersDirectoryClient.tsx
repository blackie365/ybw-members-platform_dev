"use client";

import { useState, useMemo } from 'react';
import { MemberCard } from '@/components/MemberCard';
import { Search, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';

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
      <div className="flex flex-col gap-4 mb-10">
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-lg border border-input bg-background py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
              placeholder="Search by name, company, job title, or bio..."
            />
          </div>

          {/* Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="inline-flex items-center gap-x-2 rounded-lg bg-card px-4 py-3 text-sm font-medium text-foreground ring-1 ring-inset ring-border hover:bg-secondary transition-colors"
          >
            {sortOrder === 'asc' ? (
              <>
                <ArrowDownAZ className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Sort A-Z
              </>
            ) : (
              <>
                <ArrowUpAZ className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Sort Z-A
              </>
            )}
          </button>
        </div>

        {/* Coaching Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterMentoring(!filterMentoring)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              filterMentoring
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            Open to Coaching
          </button>
          <button
            onClick={() => setFilterSeeking(!filterSeeking)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              filterSeeking
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            Seeking a Coach
          </button>
          <button
            onClick={() => setFilterBoard(!filterBoard)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              filterBoard
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            Board Roles (NED)
          </button>
        </div>
      </div>

      {/* Results Stats */}
      <div className="mb-8 flex items-center justify-between text-sm text-muted-foreground border-b border-border pb-4">
        <p>
          Showing <span className="font-medium text-foreground">{filteredAndSortedMembers.length}</span> members
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAndSortedMembers.length > 0 ? (
          filteredAndSortedMembers.map((member: any, index: number) => (
            <MemberCard key={member.id || member.email || member.slug || index} member={member} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border">
            <Search className="mx-auto h-10 w-10 text-muted-foreground mb-4" aria-hidden="true" />
            <h3 className="font-serif text-xl font-medium text-foreground mb-2">No members found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              We couldn&apos;t find anyone matching &quot;{searchTerm}&quot;. Try adjusting your search.
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

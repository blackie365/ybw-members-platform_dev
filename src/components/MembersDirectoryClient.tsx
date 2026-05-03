"use client";

import { useState, useMemo } from 'react';
import { MemberCard } from '@/components/MemberCard';
import { MagnifyingGlassIcon, BarsArrowDownIcon, BarsArrowUpIcon } from '@heroicons/react/20/solid';

export function MembersDirectoryClient({ initialMembers }: { initialMembers: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedMembers = useMemo(() => {
    // Filter
    let result = initialMembers.filter((member) => {
      const term = searchTerm.toLowerCase();
      const firstName = (member.firstName || member['First Name'] || '').toLowerCase();
      const lastName = (member.lastName || member['Last Name'] || '').toLowerCase();
      const company = (member.companyName || '').toLowerCase();
      const bio = (member.bio || member['Bio'] || '').toLowerCase();
      const jobTitle = (member.jobTitle || '').toLowerCase();

      return (
        firstName.includes(term) ||
        lastName.includes(term) ||
        company.includes(term) ||
        jobTitle.includes(term) ||
        bio.includes(term)
      );
    });

    // Sort alphabetically by first name
    result.sort((a, b) => {
      const nameA = (a.firstName || a['First Name'] || '').toLowerCase();
      const nameB = (b.firstName || b['First Name'] || '').toLowerCase();
      
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });

    return result;
  }, [initialMembers, searchTerm, sortOrder]);

  return (
    <div>
      {/* Header Section */}
      <div className="sm:flex sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800 pb-8 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Members Directory
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Discover and connect with our vibrant community of professionals and businesses across Yorkshire.
          </p>
        </div>
      </div>

      {/* Controls Section */}
      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-2xl">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <MagnifyingGlassIcon className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            name="search"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-xl border-0 py-4 pl-11 pr-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800/50 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500 transition-shadow"
            placeholder="Search by name, company, job title, or bio..."
          />
        </div>

        {/* Sort Toggle */}
        <button
          type="button"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="inline-flex items-center gap-x-2 rounded-xl bg-white dark:bg-zinc-800 px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white shadow-sm ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
        >
          {sortOrder === 'asc' ? (
            <>
              <BarsArrowDownIcon className="-ml-0.5 h-5 w-5 text-zinc-400" aria-hidden="true" />
              Sort A-Z
            </>
          ) : (
            <>
              <BarsArrowUpIcon className="-ml-0.5 h-5 w-5 text-zinc-400" aria-hidden="true" />
              Sort Z-A
            </>
          )}
        </button>
      </div>

      {/* Results Stats */}
      <div className="mb-6 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <p>Showing <span className="font-semibold text-zinc-900 dark:text-white">{filteredAndSortedMembers.length}</span> members</p>
      </div>

      {/* Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAndSortedMembers.length > 0 ? (
          filteredAndSortedMembers.map((member: any, index: number) => (
            <MemberCard key={member.id || member.email || member.slug || index} member={member} />
          ))
        ) : (
          <div className="col-span-full py-24 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-zinc-400 mb-4" aria-hidden="true" />
            <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">No members found</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              We couldn't find anyone matching "{searchTerm}". Try adjusting your search terms.
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-6 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
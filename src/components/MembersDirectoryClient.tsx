"use client";

import { useState } from 'react';
import { MemberCard } from '@/components/MemberCard';

export function MembersDirectoryClient({ initialMembers }: { initialMembers: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = initialMembers.filter((member) => {
    const term = searchTerm.toLowerCase();
    const firstName = (member.firstName || member['First Name'] || '').toLowerCase();
    const lastName = (member.lastName || member['Last Name'] || '').toLowerCase();
    const company = (member.companyName || '').toLowerCase();
    const bio = (member.bio || member['Bio'] || '').toLowerCase();

    return (
      firstName.includes(term) ||
      lastName.includes(term) ||
      company.includes(term) ||
      bio.includes(term)
    );
  });

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Members Directory
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Connect with our vibrant community of professionals and businesses.
          </p>
        </div>
      </div>

      <div className="mt-8 flex max-w-md">
        <label htmlFor="search" className="sr-only">
          Search members
        </label>
        <input
          type="search"
          name="search"
          id="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full rounded-md border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 dark:bg-zinc-800/50 dark:text-white dark:ring-white/10 dark:placeholder:text-zinc-500"
          placeholder="Search by name, company, or keywords..."
        />
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member: any, index: number) => (
            <MemberCard key={member.id || member.email || member.slug || index} member={member} />
          ))
        ) : (
          <div className="col-span-full py-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 text-lg">No members found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
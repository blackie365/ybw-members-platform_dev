import Image from 'next/image';

export function MemberCard({ member }: { member: any }) {
  const profileImage = member.avatarUrl || member.profileImage || member['Profile Image'];
  const firstName = member.firstName || member['First Name'] || '';
  const lastName = member.lastName || member['Last Name'] || '';
  const initial = firstName ? firstName[0].toUpperCase() : '?';
  const bio = member.bio || member['Bio'] || '';

  return (
    <div className="group relative flex flex-col items-start justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-6 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
      <div className="flex items-center gap-4 mb-4 w-full">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          {profileImage && !profileImage.includes('gravatar.com/avatar') ? (
            <Image
              src={profileImage}
              alt={firstName || 'Member'}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-medium text-zinc-500 dark:text-zinc-400 bg-indigo-100 dark:bg-indigo-900/30">
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
            {firstName} {lastName}
          </h2>
          {member.companyName && (
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
              {member.companyName}
            </p>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
        {bio}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {member.openToMentoring && (
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-400/20">
            Open to Mentoring
          </span>
        )}
        {member.seekingMentorship && (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/20">
            Seeking Mentorship
          </span>
        )}
        {member.openToBoardRoles && (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/20">
            Board Roles (NED)
          </span>
        )}
      </div>

      <div className="mt-4 w-full pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <a
          href={`/members/${member.memberSlug || member.slug || member.id}`}
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
        >
          View Profile &rarr;
        </a>
      </div>
    </div>
  );
}

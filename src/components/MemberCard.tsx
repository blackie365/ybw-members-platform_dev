import Image from 'next/image';

export function MemberCard({ member }: { member: any }) {
  const profileImage = member.avatarUrl || member.profileImage || member['Profile Image'];
  const firstName = member.firstName || member['First Name'] || '';
  const lastName = member.lastName || member['Last Name'] || '';
  const initial = firstName ? firstName[0] : '?';
  const bio = member.bio || member['Bio'] || '';

  return (
    <div className="group relative flex flex-col items-start justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-6 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
      <div className="flex items-center gap-4 mb-4 w-full">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          {profileImage ? (
            <Image
              src={profileImage}
              alt={firstName || 'Member'}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-medium text-zinc-500 dark:text-zinc-400 bg-emerald-100 dark:bg-emerald-900/30">
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
            {firstName} {lastName}
          </h2>
          {member.companyName && (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate">
              {member.companyName}
            </p>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
        {bio}
      </div>

      <div className="mt-4 w-full pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <a
          href={`/members/${member.memberSlug || member.slug}`}
          className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors"
        >
          View Profile &rarr;
        </a>
      </div>
    </div>
  );
}

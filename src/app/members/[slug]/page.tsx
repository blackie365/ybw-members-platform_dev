import { adminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { AdminControlWrapper } from '@/components/AdminControlWrapper';
import { ConnectButton } from '@/components/ConnectButton';

async function getMemberBySlug(slug: string) {
  try {
    // Attempt to find the member by slug in newMemberCollection
    let snapshot = await adminDb.collection('newMemberCollection')
      .where('slug', '==', slug)
      .limit(1)
      .get();
      
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
    }
    
    // Also check 'memberSlug' as some documents use that field
    snapshot = await adminDb.collection('newMemberCollection')
      .where('memberSlug', '==', slug)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
    }
    
    // Fallback: check if the slug is actually the document ID
    const docRef = await adminDb.collection('newMemberCollection').doc(slug).get();
    if (docRef.exists) {
      return { id: docRef.id, ...docRef.data() } as any;
    }

    return null;
  } catch (error) {
    console.error('Error fetching member by slug from newMemberCollection:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const member = await getMemberBySlug(resolvedParams.slug);

  if (!member) {
    return { title: 'Member Not Found' };
  }

  const firstName = member.firstName || member['First Name'] || '';
  const lastName = member.lastName || member['Last Name'] || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const profileImage = member.avatarUrl || member.profileImage || member['Profile Image'];
  const title = member.jobTitle ? `${member.jobTitle} at ${member.companyName}` : (member.companyName || '');
  const description = member.bio || member['Bio'] || `View ${fullName}'s profile on Yorkshire Businesswoman.`;

  return {
    title: `${fullName} | Member Directory`,
    description: description,
    alternates: {
      canonical: `/members/${resolvedParams.slug}`,
    },
    openGraph: {
      title: `${fullName} - ${title}`,
      description: description,
      url: `/members/${resolvedParams.slug}`,
      type: 'profile',
      images: profileImage ? [{ url: profileImage }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${fullName} - ${title}`,
      description: description,
      images: profileImage ? [profileImage] : [],
    },
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const member = await getMemberBySlug(resolvedParams.slug);

  if (!member) {
    notFound();
  }

  const profileImage =
    member.avatarUrl || member.profileImage || member['Profile Image'];
  const firstName = member.firstName || member['First Name'] || '';
  const lastName = member.lastName || member['Last Name'] || '';
  const initial = firstName ? firstName[0].toUpperCase() : '?';
  const bio = member.bio || member['Bio'] || '';
  const isFeatured = member.isFeatured === true;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back link */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/members"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          &larr; Back to Directory
        </Link>
      </div>

      <AdminControlWrapper memberId={member.id} isCurrentlyFeatured={isFeatured} />

      <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm mt-8">
        {/* Cover Photo / Gradient */}
        <div className="h-32 sm:h-48 bg-gradient-to-r from-emerald-500 to-teal-600 w-full"></div>

        <div className="px-6 sm:px-10 pb-12">
          <div className="relative flex justify-between items-end -mt-12 sm:-mt-16 mb-6">
            <div className="relative h-24 w-24 sm:h-32 sm:w-32 rounded-full ring-4 ring-white dark:ring-zinc-900 bg-emerald-100 dark:bg-emerald-900/30 overflow-hidden shadow-md flex-shrink-0">
              {profileImage && !profileImage.includes('gravatar.com/avatar') ? (
                <Image
                  src={profileImage}
                  alt={firstName}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 96px, 128px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl sm:text-5xl font-medium text-emerald-700 dark:text-emerald-400">
                  {initial}
                </div>
              )}
            </div>
            {/* Action Button */}
            <div className="absolute -bottom-6 sm:bottom-0 right-0 sm:right-0 sm:relative translate-y-full sm:translate-y-0">
              <ConnectButton recipientId={member.id} recipientName={firstName} />
            </div>
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {firstName} {lastName}
            </h1>
            {(member.jobTitle || member.companyName) && (
              <p className="text-lg sm:text-xl text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {member.jobTitle} {member.jobTitle && member.companyName && 'at'}{' '}
                {member.companyName}
              </p>
            )}
            {member.location && (
              <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 mt-3 flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {member.location}
              </p>
            )}
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              {/* Coaching & Opportunities */}
              {(member.openToMentoring || member.seekingMentorship || member.openToBoardRoles) && (
                <section className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider mb-4">
                    Opportunities & Coaching
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {member.openToMentoring && (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-400/20">
                        Open to Coaching
                      </span>
                    )}
                    {member.seekingMentorship && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/20">
                        Seeking a Coach
                      </span>
                    )}
                    {member.openToBoardRoles && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/20">
                        Board Roles (NED)
                      </span>
                    )}
                  </div>
                </section>
              )}

              {bio && (
                <section>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                    About
                  </h2>
                  <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <p className="whitespace-pre-line">{bio}</p>
                  </div>
                </section>
              )}

              {member.services && member.services.length > 0 && (
                <section>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                    Services
                  </h2>
                  <div className="flex flex-wrap gap-2.5">
                    {member.services.map((service: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/20"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-10">
              {member.tags && member.tags.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider mb-4">
                    Expertise
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {member.tags.map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {(member.website ||
                member.linkedinUrl ||
                member.twitterUrl ||
                member.instagramUrl ||
                member.facebookUrl) && (
                <section>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider mb-4">
                    Connect
                  </h2>
                  <ul className="space-y-4">
                    {member.website && (
                      <li>
                        <a
                          href={member.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 flex items-center gap-3 transition-colors"
                        >
                          <svg
                            className="w-5 h-5 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                            />
                          </svg>
                          <span className="truncate">{member.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      </li>
                    )}
                    {member.linkedinUrl && (
                      <li>
                        <a
                          href={member.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 flex items-center gap-3 transition-colors"
                        >
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                          </svg>
                          LinkedIn
                        </a>
                      </li>
                    )}
                    {member.twitterUrl && (
                      <li>
                        <a
                          href={member.twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 flex items-center gap-3 transition-colors"
                        >
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                          </svg>
                          Twitter
                        </a>
                      </li>
                    )}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
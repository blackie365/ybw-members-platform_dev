import { adminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { AdminControlWrapper } from '@/components/AdminControlWrapper';
import { ConnectButton } from '@/components/ConnectButton';
import { ArrowLeft, MapPin, Globe, Linkedin, Twitter, Instagram } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getMember(slug: string) {
  try {
    if (!adminDb) return null;

    const VALID_TIERS = ['free', 'paid', 'paid_monthly', 'paid_annual', 'complimentary', 'premium', 'founder'];
    
    function isValidMember(data: any): boolean {
      return data.userInactive !== true;
    }

    // 1. Try document ID (most reliable — matches Clerk UID used in fallback links)
    const docRef = await adminDb.collection('newMemberCollection').doc(slug).get();
    if (docRef.exists) {
      const member = { id: docRef.id, ...docRef.data() } as any;
      if (isValidMember(member)) return member;
    }
    
    // 2. Try memberSlug field (set by Clerk webhook on user creation)
    const slugSnapshot = await adminDb.collection('newMemberCollection')
      .where('memberSlug', '==', slug)
      .limit(1)
      .get();

    if (!slugSnapshot.empty) {
      const member = { id: slugSnapshot.docs[0].id, ...slugSnapshot.docs[0].data() } as any;
      if (isValidMember(member)) return member;
    }
    
    // 3. Try legacy slug field
    const legacySnapshot = await adminDb.collection('newMemberCollection')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!legacySnapshot.empty) {
      const member = { id: legacySnapshot.docs[0].id, ...legacySnapshot.docs[0].data() } as any;
      if (isValidMember(member)) return member;
    }

    return null;
  } catch (error) {
    console.error('Error fetching member by slug:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const member = await getMember(resolvedParams.slug);

  if (!member) {
    return { title: 'Member Not Found' };
  }

  const firstName = member.firstName || '';
  const lastName = member.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || member.displayName || 'Unknown Member';
  const profileImage = member.avatarUrl || member.profileImage;
  const title = member.jobTitle ? `${member.jobTitle} at ${member.companyName}` : (member.companyName || '');
  const description = member.bio || `View ${fullName}'s profile on Yorkshire Businesswoman.`;

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
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const member = await getMember(resolvedParams.slug);

  if (!member) {
    notFound();
  }

  // Find the best image URL, preferring storage over gravatar
  const avatarUrl = member.avatarUrl || "";
  const profileImageSource = member.profileImage || "";
  const profileImage = [avatarUrl, profileImageSource, member.image].find((url: any) => 
    url && typeof url === 'string' && (url.includes('storage.googleapis.com') || url.includes('firebasestorage.app'))
  ) || [avatarUrl, profileImageSource, member.image].find((url: any) => 
    url && typeof url === 'string' && url.startsWith('http') && !url.includes('gravatar.com/avatar')
  ) || avatarUrl || profileImageSource;

  // Check if image is a blank gravatar
  const isBlankGravatar = typeof profileImage === 'string' && profileImage.includes('gravatar.com/avatar') && profileImage.includes('d=blank');
  const hasRealImage = profileImage && !isBlankGravatar;

  const firstName = member.firstName || member.displayName?.split(' ')[0] || '';
  const lastName = member.lastName || member.displayName?.split(' ').slice(1).join(' ') || '';
  const initial = firstName ? firstName[0].toUpperCase() : (member.displayName?.[0] || '?').toUpperCase();
  const bio = member.bio || '';
  const isFeatured = member.isFeatured === true;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-primary py-16 sm:py-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)]" />
        </div>
        
        <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/members"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </Link>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8">
            {/* Avatar */}
            <div className="relative h-32 w-32 sm:h-40 sm:w-40 rounded-full ring-4 ring-background shadow-xl overflow-hidden flex-shrink-0">
              {hasRealImage ? (
                <Image
                  src={profileImage}
                  alt={firstName}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 128px, 160px"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl sm:text-5xl font-serif font-medium text-accent bg-accent/10">
                  {initial}
                </div>
              )}
            </div>

            {/* Name and title */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="font-serif text-3xl sm:text-4xl font-medium text-primary-foreground">
                {firstName} {lastName}
              </h1>
              {(member.jobTitle || member.companyName) && (
                <p className="mt-2 text-lg text-primary-foreground/80">
                  {member.jobTitle}{member.jobTitle && member.companyName && ' at '}{member.companyName}
                </p>
              )}
              {member.location && (
                <p className="mt-2 flex items-center justify-center sm:justify-start gap-1.5 text-sm text-primary-foreground/60">
                  <MapPin className="w-4 h-4" />
                  {member.location}
                </p>
              )}
            </div>

            {/* Connect button */}
            <div className="flex-shrink-0">
              <ConnectButton recipientId={member.id} recipientName={firstName} />
            </div>
          </div>
        </div>
      </div>

      {/* Admin controls */}
      <div className="mx-auto max-w-5xl px-6 lg:px-8 py-4">
        <AdminControlWrapper memberId={member.id} isCurrentlyFeatured={isFeatured} />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Opportunities & Coaching */}
            {(member.openToMentoring || member.seekingMentorship || member.openToBoardRoles) && (
              <section className="bg-card border border-border p-6">
                <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Opportunities & Coaching
                </h2>
                <div className="flex flex-wrap gap-2">
                  {member.openToMentoring && (
                    <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20">
                      Open to Coaching
                    </span>
                  )}
                  {member.seekingMentorship && (
                    <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20">
                      Seeking a Coach
                    </span>
                  )}
                  {member.openToBoardRoles && (
                    <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20">
                      Board Roles (NED)
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* About */}
            {bio && (
              <section>
                <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
                  About
                </h2>
                <div className="prose prose-stone max-w-none">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {bio}
                  </p>
                </div>
              </section>
            )}

            {/* Services */}
            {member.services && member.services.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
                  Services
                </h2>
                <div className="flex flex-wrap gap-2">
                  {member.services.map((service: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-secondary border border-border"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Expertise */}
            {member.tags && member.tags.length > 0 && (
              <section className="bg-card border border-border p-6">
                <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Expertise
                </h2>
                <div className="flex flex-wrap gap-2">
                  {member.tags.map((tag: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Connect Links */}
            {(member.website || member.linkedinUrl || member.twitterUrl || member.instagramUrl) && (
              <section className="bg-card border border-border p-6">
                <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Connect
                </h2>
                <ul className="space-y-4">
                  {member.website && (
                    <li>
                      <a
                        href={member.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent transition-colors"
                      >
                        <Globe className="w-5 h-5 flex-shrink-0" />
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
                        className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent transition-colors"
                      >
                        <Linkedin className="w-5 h-5 flex-shrink-0" />
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
                        className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent transition-colors"
                      >
                        <Twitter className="w-5 h-5 flex-shrink-0" />
                        Twitter
                      </a>
                    </li>
                  )}
                  {member.instagramUrl && (
                    <li>
                      <a
                        href={member.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent transition-colors"
                      >
                        <Instagram className="w-5 h-5 flex-shrink-0" />
                        Instagram
                      </a>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* Industry/Sector */}
            {member.industrySector && (
              <section className="bg-card border border-border p-6">
                <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Industry
                </h2>
                <p className="text-sm text-foreground">{member.industrySector}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

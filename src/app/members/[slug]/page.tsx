import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Globe, Instagram, Linkedin, MapPin, Twitter } from 'lucide-react';

import { AdminControlWrapper } from '@/components/AdminControlWrapper';
import { ConnectButton } from '@/components/ConnectButton';
import {
  AVAILABILITY_FLAGS,
  asString,
  displayNameOf,
  initialsFor,
  isPremiumTier,
  resolvePortrait,
} from '@/features/members/display';
import { MemberPortrait, type PortraitSubject } from '@/components/MemberCard';
import { getMemberStore } from '@/features/members/server';

export const dynamic = 'force-dynamic';

const EYEBROW = 'text-[11px] font-medium uppercase tracking-[0.17em] text-ink-muted';

async function getMember(slug: string) {
  try {
    const store = getMemberStore();

    function isValidMember(member: any): boolean {
      return member.userInactive !== true;
    }

    async function tryMember(
      candidate: Awaited<ReturnType<typeof store.getMemberByClerkId>> | null,
    ) {
      if (!candidate) return null;
      const member = { id: candidate.clerkId, ...candidate } as any;
      if (isValidMember(member)) return member;
      return null;
    }

    // 1. Try document ID (most reliable — matches Clerk UID used in fallback links)
    const byId = await tryMember(await store.getMemberByClerkId(slug));
    if (byId) return byId;

    // 2. Try memberSlug / legacy slug field (set by Clerk webhook on user creation)
    const bySlug = await tryMember(await store.getMemberBySlug(slug));
    if (bySlug) return bySlug;

    return null;
  } catch (error) {
    console.error('Error fetching member by slug:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const member = await getMember(resolvedParams.slug);

  if (!member) {
    return { title: 'Member Not Found' };
  }

  const data = member as Record<string, unknown>;
  const fullName = displayNameOf(data) || 'Member';
  const role = asString(data.jobTitle) || asString(data.role);
  const company = asString(data.companyName) || asString(data.company);
  const portrait = resolvePortrait(data);

  return {
    title: `${fullName} | Member Directory`,
    description: asString(data.bio) || `View ${fullName}'s profile on Yorkshire Businesswoman.`,
    alternates: {
      canonical: `/members/${resolvedParams.slug}`,
    },
    openGraph: {
      title: role && company ? `${fullName} - ${role} at ${company}` : `${fullName} - Member Directory`,
      description: asString(data.bio) || `View ${fullName}'s profile on Yorkshire Businesswoman.`,
      url: `/members/${resolvedParams.slug}`,
      type: 'profile',
      images: portrait.hasImage ? [{ url: portrait.image }] : [],
    },
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className={EYEBROW}>{children}</h2>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-5 border-b border-border py-2.5">
      <dt className="text-[12px] uppercase tracking-[0.13em] text-ink-muted">{label}</dt>
      <dd className="text-right text-[13.5px] text-foreground">{value}</dd>
    </div>
  );
}

/**
 * The member's own page, built from the same parts as the directory entry above
 * it: one large portrait plate, the name in Playfair, and hairline rules doing
 * the dividing. It is the destination of the register's "Open member profile"
 * action, so the visitor should not feel they have left the register.
 */
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

  const data = member as Record<string, unknown>;

  const firstName = asString(data.firstName);
  const lastName = asString(data.lastName);
  const name = displayNameOf(data) || 'Member';
  const role = asString(data.jobTitle) || asString(data.role);
  const company = asString(data.companyName) || asString(data.company);
  const location = asString(data.location) || asString(data.city);
  const bio = asString(data.bio);
  const industry = asString(data.industrySector);
  const services = stringList(data.services);
  const expertise = stringList(data.tags);
  const website = asString(data.website) || asString(data.websiteUrl);
  const linkedin = asString(data.linkedinUrl) || asString(data.linkedin);
  const twitter = asString(data.twitterUrl);
  const instagram = asString(data.instagramUrl);
  const isFeatured = data.isFeatured === true;
  const tier = asString(data.membershipTier) || 'free';

  const availability = AVAILABILITY_FLAGS.filter((flag) => data[flag.key] === true);

  const portrait: PortraitSubject = {
    name,
    initials: initialsFor(firstName, lastName, name),
    role,
    company,
    isPremium: isPremiumTier(tier),
    ...resolvePortrait(data),
  };

  const links = [
    { key: 'website', label: 'Website', href: website, Icon: Globe, display: website.replace(/^https?:\/\/(www\.)?/, '') },
    { key: 'linkedin', label: 'LinkedIn', href: linkedin, Icon: Linkedin, display: 'LinkedIn' },
    { key: 'twitter', label: 'Twitter', href: twitter, Icon: Twitter, display: 'Twitter' },
    { key: 'instagram', label: 'Instagram', href: instagram, Icon: Instagram, display: 'Instagram' },
  ].filter((link) => Boolean(link.href));

  return (
    <div className="bg-background">
      <section className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-10 sm:px-6">
        <div className="flex items-baseline justify-between gap-6 border-b border-border pb-4">
          <Link
            href="/members"
            className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.17em] text-ink-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            All members
          </Link>
          <p className={EYEBROW}>Member profile</p>
        </div>

        <div className="mt-9 grid items-start gap-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <MemberPortrait
              member={portrait}
              sizes="(min-width: 1024px) 400px, 100vw"
              monogramSize="lg"
              className="aspect-[271/264] lg:aspect-[4/5]"
            />

            <dl className="mt-5 border-t border-border">
              {location && <DetailRow label="Based in" value={location} />}
              {industry && <DetailRow label="Industry" value={industry} />}
              {company && <DetailRow label="Company" value={company} />}
              {isFeatured && <DetailRow label="Listing" value="Featured member" />}
            </dl>

            <div className="mt-6">
              <ConnectButton recipientId={member.id} recipientName={firstName || name} />
              <AdminControlWrapper memberId={member.id} isCurrentlyFeatured={isFeatured} />
            </div>
          </div>

          <div>
            <h1 className="font-serif text-[40px] leading-[1.03] tracking-[-0.01em] text-foreground sm:text-[54px]">
              {name}
            </h1>

            {role && <p className="mt-4 text-[15px] leading-[1.45] text-ink-soft">{role}</p>}
            {company && (
              <p className="text-[15px] font-medium leading-[1.45] text-foreground">{company}</p>
            )}
            {location && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {location}
              </p>
            )}

            {availability.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {availability.map((flag) => (
                  <li key={flag.key} className="inline-flex items-center gap-2 text-[13px] text-accent">
                    <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-accent" />
                    {flag.label}
                  </li>
                ))}
              </ul>
            )}

            {bio && (
              <section className="mt-9 border-t border-border pt-6">
                <SectionLabel>About</SectionLabel>
                <p className="mt-3 whitespace-pre-line text-[14.5px] leading-[1.7] text-ink-soft">
                  {bio}
                </p>
              </section>
            )}

            {services.length > 0 && (
              <section className="mt-8 border-t border-border pt-6">
                <SectionLabel>Services</SectionLabel>
                <ul className="mt-1">
                  {services.map((service) => (
                    <li
                      key={service}
                      className="border-b border-border py-2.5 text-[14px] leading-[1.5] text-ink-soft"
                    >
                      {service}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {expertise.length > 0 && (
              <section className="mt-8 border-t border-border pt-6">
                <SectionLabel>Expertise</SectionLabel>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {expertise.map((tag) => (
                    <li
                      key={tag}
                      className="border border-rule-strong px-2.5 py-1 text-[12px] uppercase tracking-[0.08em] text-ink-soft"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {links.length > 0 && (
              <section className="mt-8 border-t border-border pt-6">
                <SectionLabel>Links</SectionLabel>
                <ul className="mt-1">
                  {links.map(({ key, label, href, Icon, display }) => (
                    <li key={key}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-6 border-b border-border py-3 text-[13.5px] text-ink-soft transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                          {label}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{display}</span>
                          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

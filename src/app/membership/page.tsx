'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Check, ArrowRight, Sparkles, Users, Building2 } from 'lucide-react';

const tiers = [
  {
    name: 'Free Subscriber',
    id: 'tier-free',
    href: '/register',
    priceMonthly: '£0',
    priceAnnually: '£0',
    icon: Users,
    description: 'The essential Yorkshire Businesswoman experience. Perfect for staying up to date.',
    features: [
      'Weekly newsletter access',
      'Read public articles and news',
      'Basic community updates',
      'Event notifications',
    ],
    mostPopular: false,
  },
  {
    name: 'Premium Member',
    id: 'tier-premium',
    href: '/register?plan=premium',
    priceMonthly: '£25',
    priceAnnually: '£275',
    icon: Sparkles,
    description: 'Full access to the platform. Grow your network and unlock exclusive opportunities.',
    features: [
      'Everything in Free',
      'Full access to the Member Directory',
      'Create and edit your public Profile',
      'Read all Premium & Exclusive articles',
      'Access the Private Member Space',
      'Exclusive Member Offers & Discounts',
      'Priority booking for YBW Events',
    ],
    mostPopular: true,
  },
  {
    name: 'Corporate Partner',
    id: 'tier-corporate',
    href: '/news?tag=contact',
    priceMonthly: '£150',
    priceAnnually: '£1440',
    icon: Building2,
    description: 'For businesses looking to maximize their brand exposure across Yorkshire.',
    features: [
      'Everything in Premium',
      'Multiple team member accounts',
      'Featured placement in the Directory',
      'Submit PR and articles for publishing',
      'Sponsorship opportunities',
      'Dedicated account manager',
    ],
    mostPopular: false,
  },
];

export default function MembershipPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const handleTierClick = async (e: React.MouseEvent<HTMLAnchorElement>, tierId: string, href: string) => {
    if (tierId !== 'tier-premium' || !user) {
      return;
    }

    e.preventDefault();
    setLoadingTier(tierId);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'premium',
          cycle: billingCycle,
          userEmail: user.email,
          userId: user.uid,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        router.push(href);
      }
    } catch (err) {
      console.error('Failed to initiate checkout:', err);
      router.push(href);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="bg-background">
      {/* Hero section */}
      <div className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-accent" />
          <div className="absolute -bottom-40 right-0 h-[400px] w-[400px] rounded-full bg-accent" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Membership Plans
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground sm:text-5xl lg:text-6xl">
              Join a Community of Ambitious Women
            </h1>
            <p className="mt-6 text-lg text-primary-foreground/70 leading-relaxed max-w-2xl mx-auto">
              Whether you want to stay informed with our free newsletter or unlock the full power of our networking platform, we have a plan designed for your journey.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing section */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-full p-1 bg-muted">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-full px-6 py-2.5 text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annually')}
              className={`rounded-full px-6 py-2.5 text-sm font-medium transition-all ${
                billingCycle === 'annually'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annually
              <span className={`ml-2 text-xs font-semibold ${
                billingCycle === 'annually' ? 'text-accent' : 'text-accent/70'
              }`}>
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="mx-auto mt-12 grid max-w-md grid-cols-1 gap-6 md:max-w-2xl md:grid-cols-2 lg:max-w-none lg:grid-cols-3 lg:gap-8">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                  tier.mostPopular
                    ? 'border-accent bg-card shadow-xl scale-[1.02] lg:scale-105'
                    : 'border-border bg-card hover:border-accent/30 hover:shadow-lg'
                }`}
              >
                {tier.mostPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full bg-accent px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${
                    tier.mostPopular ? 'bg-accent/10' : 'bg-muted'
                  }`}>
                    <Icon className={`h-6 w-6 ${tier.mostPopular ? 'text-accent' : 'text-muted-foreground'}`} />
                  </div>
                </div>

                <h3 className="font-serif text-2xl font-medium text-foreground">
                  {tier.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {tier.description}
                </p>

                <div className="mt-6 flex items-baseline">
                  <span className="font-serif text-5xl font-medium text-foreground">
                    {billingCycle === 'annually' ? tier.priceAnnually : tier.priceMonthly}
                  </span>
                  {tier.priceMonthly !== '£0' && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      /{billingCycle === 'annually' ? 'year' : 'month'}
                    </span>
                  )}
                </div>

                <ul className="mt-8 flex-1 space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        tier.mostPopular ? 'bg-accent/10' : 'bg-muted'
                      }`}>
                        <Check className={`h-3 w-3 ${tier.mostPopular ? 'text-accent' : 'text-muted-foreground'}`} />
                      </div>
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.id === 'tier-corporate' ? tier.href : `${tier.href}${tier.href.includes('?') ? '&' : '?'}cycle=${billingCycle}`}
                  onClick={(e) => handleTierClick(e, tier.id, `${tier.href}${tier.href.includes('?') ? '&' : '?'}cycle=${billingCycle}`)}
                  className={`mt-8 flex items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-semibold transition-all ${
                    tier.mostPopular
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : 'border border-border bg-card text-foreground hover:bg-muted'
                  }`}
                >
                  {loadingTier === tier.id ? (
                    'Processing...'
                  ) : (
                    <>
                      {tier.id === 'tier-corporate' ? 'Contact Us' : 'Get Started'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ Teaser */}
        <div className="mt-20 text-center">
          <p className="text-muted-foreground">
            Have questions about membership?{' '}
            <Link href="/contact" className="font-medium text-accent hover:text-accent/80 transition-colors">
              Get in touch
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

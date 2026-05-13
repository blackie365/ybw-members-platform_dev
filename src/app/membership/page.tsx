'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckIcon } from '@heroicons/react/20/solid';

const tiers = [
  {
    name: 'Free Subscriber',
    id: 'tier-free',
    href: '/register',
    priceMonthly: '£0',
    priceAnnually: '£0',
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
    href: '/register?plan=premium', // Hooks into Firebase Custom System
    priceMonthly: '£25', // Edit this price
    priceAnnually: '£275', // Edit this price (currently £12 * 12)
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
    priceMonthly: '£150', // Edit this price
    priceAnnually: '£1440', // Edit this price
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

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function MembershipPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');

  return (
    <div className="py-24 sm:py-32 bg-[#f7f5f1] dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">Pricing & Memberships</h2>
          <p className="mt-4 font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Join the Yorkshire Businesswoman Community
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-muted-foreground">
          Whether you want to stay in the loop with our free newsletter or unlock the full power of our networking platform, we have a plan for you.
        </p>

        {/* Billing Toggle (UI Only for now) */}
        <div className="mt-16 flex justify-center">
          <div className="grid grid-cols-2 gap-x-1 rounded-full p-1 text-center text-xs font-semibold uppercase tracking-wider leading-5 ring-1 ring-inset ring-border bg-white dark:bg-zinc-900">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={classNames(
                billingCycle === 'monthly' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
                'cursor-pointer rounded-full px-4 py-2 transition-colors'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annually')}
              className={classNames(
                billingCycle === 'annually' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
                'cursor-pointer rounded-full px-4 py-2 transition-colors'
              )}
            >
              Annually <span className={classNames("font-normal ml-1", billingCycle === 'annually' ? "text-primary-foreground/70" : "text-accent")}>Save 20%</span>
            </button>
          </div>
        </div>

        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-8 md:max-w-2xl md:grid-cols-2 lg:max-w-4xl xl:mx-0 xl:max-w-none xl:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={classNames(
                tier.mostPopular ? 'ring-2 ring-accent dark:ring-accent' : 'ring-1 ring-border',
                'rounded-none p-8 xl:p-10 bg-white dark:bg-zinc-900 flex flex-col justify-between relative shadow-sm'
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3
                    id={tier.id}
                    className="font-serif text-2xl font-medium text-foreground"
                  >
                    {tier.name}
                  </h3>
                  {tier.mostPopular ? (
                    <p className="absolute -top-3 right-8 bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Most popular
                    </p>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{tier.description}</p>
                <p className="mt-8 flex items-baseline gap-x-1">
                  <span className="font-serif text-5xl font-medium text-foreground">
                    {billingCycle === 'annually' ? tier.priceAnnually : tier.priceMonthly}
                  </span>
                  {tier.priceMonthly !== '£0' && (
                    <span className="text-sm font-medium text-muted-foreground">
                      /{billingCycle === 'annually' ? 'year' : 'month'}
                    </span>
                  )}
                </p>
                <ul role="list" className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckIcon className="h-5 w-5 flex-none text-accent" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={tier.id === 'tier-corporate' ? tier.href : `${tier.href}${tier.href.includes('?') ? '&' : '?'}cycle=${billingCycle}`}
                aria-describedby={tier.id}
                className={classNames(
                  tier.mostPopular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-primary ring-1 ring-inset ring-primary hover:bg-primary hover:text-primary-foreground dark:text-primary-foreground dark:ring-border dark:hover:bg-muted',
                  'mt-8 block px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors'
                )}
              >
                {tier.id === 'tier-corporate' ? 'Contact Us' : 'Get Started'}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

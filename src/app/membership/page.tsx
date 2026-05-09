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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');

  return (
    <div className="py-24 sm:py-32 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">Pricing & Memberships</h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-white">
            Join the Yorkshire Businesswoman Community
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Whether you want to stay in the loop with our free newsletter or unlock the full power of our networking platform, we have a plan for you.
        </p>

        {/* Billing Toggle (UI Only for now) */}
        <div className="mt-16 flex justify-center">
          <div className="grid grid-cols-2 gap-x-1 rounded-full p-1 text-center text-xs font-semibold leading-5 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-900/50">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={classNames(
                billingCycle === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                'cursor-pointer rounded-full px-2.5 py-1 transition-colors'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annually')}
              className={classNames(
                billingCycle === 'annually' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                'cursor-pointer rounded-full px-2.5 py-1 transition-colors'
              )}
            >
              Annually <span className="font-normal text-indigo-200 dark:text-indigo-300 ml-1">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 md:max-w-2xl md:grid-cols-2 lg:max-w-4xl xl:mx-0 xl:max-w-none xl:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={classNames(
                tier.mostPopular ? 'ring-2 ring-indigo-600 dark:ring-indigo-500' : 'ring-1 ring-zinc-200 dark:ring-white/10',
                'rounded-3xl p-8 xl:p-10 bg-white dark:bg-zinc-800/50 flex flex-col justify-between'
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3
                    id={tier.id}
                    className={classNames(
                      tier.mostPopular ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-white',
                      'text-lg font-semibold leading-8'
                    )}
                  >
                    {tier.name}
                  </h3>
                  {tier.mostPopular ? (
                    <p className="rounded-full bg-indigo-600/10 px-2.5 py-1 text-xs font-semibold leading-5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                      Most popular
                    </p>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{tier.description}</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {billingCycle === 'annually' ? tier.priceAnnually : tier.priceMonthly}
                  </span>
                  {tier.priceMonthly !== '£0' && (
                    <span className="text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-400">
                      /{billingCycle === 'annually' ? 'year' : 'month'}
                    </span>
                  )}
                </p>
                <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckIcon className="h-6 w-5 flex-none text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={tier.href}
                aria-describedby={tier.id}
                className={classNames(
                  tier.mostPopular
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-indigo-600'
                    : 'text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300 dark:text-indigo-400 dark:ring-indigo-500/30 dark:hover:ring-indigo-500/50 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-900/10 dark:hover:bg-indigo-900/20',
                  'mt-8 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors'
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Booking received — Yorkshire Businesswoman',
  robots: { index: false, follow: false },
};

export default async function AdvertiseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Thank you</p>
        <h1 className="mt-4 font-serif text-4xl font-medium text-foreground">
          Your booking is confirmed
        </h1>
        {ref && (
          <p className="mt-4 text-sm text-muted-foreground">
            Your reference is <span className="font-medium text-foreground">{ref}</span>. Quote it if
            you contact us.
          </p>
        )}
        <div className="mt-8 space-y-4 text-muted-foreground">
          <p>
            Your payment has gone through and your space is reserved. If your package needs a
            print-ready PDF, we will email you a request shortly.
          </p>
          <p>
            Your booking now goes to the editor for review. Nothing is published until that review is
            complete, and we will be in touch if we need anything else from you.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild className="bg-accent hover:bg-accent/90 text-white">
            <Link href="/">Back to the home page</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/magazine">Read the magazine</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import { adminDb } from '@/lib/firebase-admin';

export async function ExclusiveMemberOffers() {
  let offers: any[] = [];
  try {
    if (!adminDb) return null;
    
    // Fetch top 3 active offers
    const snapshot = await adminDb.collection('offer_requests')
      .where('status', '==', 'active')
      .limit(3)
      .get();
      
    offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching dashboard offers:', err);
    return null;
  }

  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-2xl font-medium text-foreground">Member-Only Offers</h2>
          <span className="inline-flex items-center rounded-none bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20">
            Exclusive
          </span>
        </div>
        <Link href="/dashboard/offers" className="text-[10px] font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors">
          View All Offers
        </Link>
      </div>
      
      <div className="space-y-6">
        {offers.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer: any) => (
              <div key={offer.id} className="group relative flex flex-col items-start justify-between border border-border p-5 hover:bg-muted/30 transition-colors">
                {offer.imageUrl && (
                  <div className="relative w-full mb-5 overflow-hidden">
                    <Image
                      src={offer.imageUrl}
                      alt={offer.title}
                      width={400}
                      height={250}
                      className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex items-center gap-x-3 text-[10px] uppercase tracking-wider mb-3">
                  <span className="text-accent font-medium">{offer.userName || 'Member'}</span>
                  {offer.isMembersOnly && <span className="text-muted-foreground">| Members Only</span>}
                </div>
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground group-hover:text-accent transition-colors mb-4">
                  <Link href="/dashboard/offers">
                    <span className="absolute inset-0" />
                    <span className="line-clamp-2">{offer.title}</span>
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                  {offer.description}
                </p>
                <div className="mt-auto pt-4 border-t border-border w-full">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent group-hover:text-foreground">
                    Claim Offer →
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-border bg-muted/20">
            <p className="text-sm text-muted-foreground mb-4">
              No member-exclusive offers at the moment.
            </p>
            <Link href="/dashboard/offers/create" className="text-xs font-semibold text-accent hover:underline">
              Submit your first offer →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

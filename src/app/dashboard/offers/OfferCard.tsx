import Image from 'next/image';
import Link from 'next/link';

interface OfferCardProps {
  offer: any;
  isPublicBoard: boolean;
  claimingId: string | null;
  setClaimingId: (id: string | null) => void;
  router: any;
}

export function OfferCard({ 
  offer, 
  isPublicBoard, 
  claimingId, 
  setClaimingId, 
  router 
}: OfferCardProps) {
  return (
    <div className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-none p-5 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-all hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20 overflow-hidden">
      {offer.feature_image && (
        <div className="relative w-full mb-5 overflow-hidden rounded-none">
          <Image
            src={offer.feature_image}
            alt={offer.title}
            width={600}
            height={400}
            className="aspect-[16/9] w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      
      <div className="flex-1 w-full">
        <div className="flex items-center gap-x-2 text-xs mb-3 w-full overflow-hidden">
          <span className="inline-flex items-center rounded-none bg-emerald-50 px-2 py-1 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20">
            Active Offer
          </span>
          {offer.isMembersOnly && (
            <span className="inline-flex items-center rounded-none bg-amber-50 px-2 py-1 font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20">
              Members Only
            </span>
          )}
          {offer.userId && (
            <Link href={`/members/${offer.userId}`} className="text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors relative z-10 truncate">
              by {offer.primary_author?.name || offer.userName}
            </Link>
          )}
        </div>
        
        <h3 className="text-xl font-semibold leading-tight text-zinc-900 hover:text-accent dark:text-white dark:hover:text-accent mb-3 relative z-10 break-words w-full">
          {offer.isMembersOnly && isPublicBoard ? (
            <Link href="/membership">
              {offer.title} (Member Exclusive)
            </Link>
          ) : offer.isFirestoreOffer ? (
            offer.link ? (
              <a href={offer.link} target="_blank" rel="noopener noreferrer">
                {offer.title}
              </a>
            ) : (
              <button onClick={() => setClaimingId(offer.id === claimingId ? null : offer.id)}>
                {offer.title}
              </button>
            )
          ) : (
            <Link href={`/news/${offer.slug}`}>
              {offer.title}
            </Link>
          )}
        </h3>
        
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6 whitespace-pre-wrap break-words w-full">
          {offer.isMembersOnly && isPublicBoard 
            ? "This offer is reserved for Yorkshire Businesswoman members. Join today to unlock this discount and many other exclusive perks."
            : (offer.custom_excerpt || offer.excerpt)}
        </p>
      </div>

      <div className="mt-auto w-full pt-4 border-t border-zinc-200 dark:border-zinc-700 relative z-10">
        {offer.isMembersOnly && isPublicBoard ? (
          <Link href="/membership" className="text-sm font-semibold text-accent hover:text-accent/80 flex items-center gap-1">
            Join to unlock
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </Link>
        ) : (
          <button 
            onClick={() => {
              if (offer.isFirestoreOffer && !offer.link) {
                setClaimingId(offer.id);
              } else if (offer.link) {
                window.open(offer.link, '_blank');
              } else {
                router.push(`/news/${offer.slug}`);
              }
            }}
            className="text-sm font-semibold text-accent hover:text-accent/80 flex items-center gap-1 w-full text-left"
          >
            {offer.isFirestoreOffer && !offer.link ? 'Request Offer' : (offer.isFirestoreOffer ? 'Claim Offer' : 'View Details')}
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

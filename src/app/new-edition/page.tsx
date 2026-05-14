import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Latest Edition | Yorkshire Businesswoman',
  description: 'Read the latest edition of the Yorkshire Businesswoman magazine online.',
};

export default function NewEditionPage() {
  return (
    <main className="flex-1 bg-[#f7f5f1] dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
            Latest Edition
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Read the newest issue of Yorkshire Businesswoman magazine directly in your browser.
          </p>
        </div>

        {/* Issuu Embed Container */}
        <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
          <div 
            style={{ position: 'relative', paddingTop: 'max(60%, 326px)', height: 0, width: '100%' }}
          >
            <iframe 
              title="ybw_APRil-MAY_2026" 
              allow="clipboard-write; autoplay; encrypted-media; fullscreen; picture-in-picture" 
              sandbox="allow-top-navigation allow-top-navigation-by-user-activation allow-downloads allow-scripts allow-same-origin allow-popups allow-modals allow-popups-to-escape-sandbox allow-forms" 
              allowFullScreen={true} 
              style={{ position: 'absolute', border: 'none', width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0 }} 
              src="https://e.issuu.com/embed.html?d=ybw_april-may_2026&u=blackie365"
            />
          </div>
        </div>
        
        {/* Call to Action for past editions if needed */}
        <div className="mt-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Want a physical copy? <a href="/membership" className="font-medium text-[#b79c65] hover:underline">Join us as a Premium Member</a> and pick one up at our events !
          </p>
        </div>
      </div>
    </main>
  );
}
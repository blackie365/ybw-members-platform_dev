import { Metadata } from 'next';
import { Header } from '@/components/magazine/header';
import { Footer } from '@/components/magazine/footer';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy | Yorkshire Businesswoman',
  description: 'Information about how we use cookies on our platform.',
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 sm:p-12 prose dark:prose-invert prose-emerald max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-8">
            Cookie Policy
          </h1>
          
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">1. What are cookies?</h2>
            <p className="text-zinc-700 dark:text-zinc-300">
              Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used in order to make websites work, or work more efficiently, as well as to provide information to the owners of the site.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">2. How we use cookies</h2>
            <p className="text-zinc-700 dark:text-zinc-300 mb-4">
              We use cookies for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300">
              <li><strong>Essential Cookies:</strong> These are required for the operation of our website. They include, for example, cookies that enable you to log into secure areas of our website (like the Member Dashboard) and use a shopping cart.</li>
              <li><strong>Analytical/Performance Cookies:</strong> They allow us to recognise and count the number of visitors and to see how visitors move around our website when they are using it. This helps us to improve the way our website works.</li>
              <li><strong>Functionality Cookies:</strong> These are used to recognise you when you return to our website. This enables us to personalise our content for you, greet you by name and remember your preferences (for example, your choice of light or dark mode).</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">3. Third-party cookies</h2>
            <p className="text-zinc-700 dark:text-zinc-300">
              Please note that third parties (including, for example, advertising networks and providers of external services like web traffic analysis services) may also use cookies, over which we have no control. These cookies are likely to be analytical/performance cookies or targeting cookies. We use Stripe for secure payment processing, which relies on cookies to function securely.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">4. Managing cookies</h2>
            <p className="text-zinc-700 dark:text-zinc-300 mb-4">
              You can block cookies by activating the setting on your browser that allows you to refuse the setting of all or some cookies. However, if you use your browser settings to block all cookies (including essential cookies) you may not be able to access all or parts of our website, particularly the Member Dashboard.
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              To find out more about cookies, including how to see what cookies have been set and how to manage and delete them, visit <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">allaboutcookies.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">5. Contact us</h2>
            <p className="text-zinc-700 dark:text-zinc-300">
              If you have any questions about our Cookie Policy, please contact us via our <Link href="/contact" className="text-emerald-600 dark:text-emerald-400 hover:underline">Contact page</Link>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

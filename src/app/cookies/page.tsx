import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy | Yorkshire Businesswoman',
  description: 'Information about how we use cookies on our platform.',
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-primary py-20 sm:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70 mb-4">
              Legal
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl">
              Cookie Policy
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-primary-foreground/70">
              Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-16 sm:py-20">
        <div className="prose prose-lg max-w-none
          prose-headings:font-serif prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-foreground
          prose-p:text-muted-foreground prose-p:leading-relaxed
          prose-a:text-accent prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground prose-strong:font-semibold
          prose-ul:text-muted-foreground prose-ol:text-muted-foreground
          prose-li:text-muted-foreground">
          
          <section className="mb-12">
            <h2>1. What are cookies?</h2>
            <p>
              Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used in order to make websites work, or work more efficiently, as well as to provide information to the owners of the site.
            </p>
          </section>

          <section className="mb-12">
            <h2>2. How we use cookies</h2>
            <p>We use cookies for the following purposes:</p>
            <ul className="space-y-3">
              <li>
                <strong className="text-foreground">Essential Cookies:</strong> These are required for the operation of our website. They include, for example, cookies that enable you to log into secure areas of our website (like the Member Dashboard) and use a shopping cart.
              </li>
              <li>
                <strong className="text-foreground">Analytical/Performance Cookies:</strong> They allow us to recognise and count the number of visitors and to see how visitors move around our website when they are using it. This helps us to improve the way our website works.
              </li>
              <li>
                <strong className="text-foreground">Functionality Cookies:</strong> These are used to recognise you when you return to our website. This enables us to personalise our content for you, greet you by name and remember your preferences (for example, your choice of light or dark mode).
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2>3. Third-party cookies</h2>
            <p>
              Please note that third parties (including, for example, advertising networks and providers of external services like web traffic analysis services) may also use cookies, over which we have no control. These cookies are likely to be analytical/performance cookies or targeting cookies. We use Stripe for secure payment processing, which relies on cookies to function securely.
            </p>
          </section>

          <section className="mb-12">
            <h2>4. Managing cookies</h2>
            <p>
              You can block cookies by activating the setting on your browser that allows you to refuse the setting of all or some cookies. However, if you use your browser settings to block all cookies (including essential cookies) you may not be able to access all or parts of our website, particularly the Member Dashboard.
            </p>
            <p>
              To find out more about cookies, including how to see what cookies have been set and how to manage and delete them, visit{' '}
              <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer">
                allaboutcookies.org
              </a>.
            </p>
          </section>

          <section>
            <h2>5. Contact us</h2>
            <p>
              If you have any questions about our Cookie Policy, please contact us via our{' '}
              <Link href="/contact">Contact page</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

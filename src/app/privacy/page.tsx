import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Our commitment to protecting your personal data and privacy.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

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
              Privacy Policy
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-primary-foreground/70">
              Last updated: {lastUpdated}
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
          
          <p>
            At Yorkshire Businesswoman, we are committed to protecting and respecting your privacy. This policy explains when and why we collect personal information about people who visit our website, how we use it, the conditions under which we may disclose it to others, and how we keep it secure.
          </p>

          <section className="mb-12">
            <h2>1. Who are we?</h2>
            <p>
              Yorkshire BusinessWoman is a professional network and magazine platform dedicated to empowering businesswomen across the region. The brand is owned and operated by Ghost Publishing Ltd. Any personal information provided to or gathered by Yorkshire BusinessWoman is controlled by Ghost Publishing Ltd.
            </p>
          </section>

          <section className="mb-12">
            <h2>2. How do we collect information from you?</h2>
            <p>
              We obtain information about you when you use our website, for example, when you contact us about our services, register for membership, subscribe to our newsletter, or purchase tickets for an event.
            </p>
          </section>

          <section className="mb-12">
            <h2>3. What type of information is collected?</h2>
            <p>
              The personal information we collect might include your name, address, email address, job title, company name, and information regarding what pages are accessed and when. If you purchase a membership or event ticket, your card information is not held by us, it is collected by our third-party payment processors (Stripe), who specialise in the secure online capture and processing of credit/debit card transactions.
            </p>
          </section>

          <section className="mb-12">
            <h2>4. How is your information used?</h2>
            <p>We may use your information to:</p>
            <ul className="space-y-3">
              <li>Process a membership application or event booking.</li>
              <li>Carry out our obligations arising from any contracts entered into by you and us.</li>
              <li>Seek your views or comments on the services we provide.</li>
              <li>Notify you of changes to our services.</li>
              <li>Send you communications which you have requested and that may be of interest to you, such as our daily newsletter.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2>5. Who has access to your information?</h2>
            <p>
              We will not sell or rent your information to third parties. We will not share your information with third parties for marketing purposes.
            </p>
            <p>
              <strong>Third Party Service Providers working on our behalf:</strong> We may pass your information to our third-party service providers (such as Stripe for payments and Resend for email delivery) for the purposes of completing tasks and providing services to you on our behalf. However, when we use third-party service providers, we disclose only the personal information that is necessary to deliver the service.
            </p>
          </section>

          <section className="mb-12">
            <h2>6. Your choices</h2>
            <p>
              You have a choice about whether or not you wish to receive information from us. If you do not want to receive direct marketing communications from us, you can select your choices by ticking the relevant boxes situated on the form on which we collect your information.
            </p>
            <p>
              We will not contact you for marketing purposes by email, phone or text message unless you have given your prior consent. You can change your marketing preferences at any time by contacting us or using the &apos;unsubscribe&apos; link at the bottom of our emails.
            </p>
          </section>

          <section className="mb-12">
            <h2>7. How you can access and update your information</h2>
            <p>
              The accuracy of your information is important to us. You can update your profile information at any time by logging into the Member Dashboard. You also have the right to ask for a copy of the information Yorkshire Businesswoman holds about you.
            </p>
          </section>

          <section className="mb-12">
            <h2>8. Security precautions</h2>
            <p>
              When you give us personal information, we take steps to ensure that it&apos;s treated securely. Any sensitive information (such as credit or debit card details) is encrypted and protected with SSL encryption.
            </p>
          </section>

          <section>
            <h2>9. Contact us</h2>
            <p>
              If you have any questions regarding this policy or our privacy practices, please contact us via our{' '}
              <Link href="/contact">Contact page</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

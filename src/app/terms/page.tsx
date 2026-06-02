import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Yorkshire Businesswoman',
  description: 'The terms and conditions governing the use of the Yorkshire Businesswoman platform.',
};

export default function TermsOfServicePage() {
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
              Terms of Service
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
            Welcome to Yorkshire Businesswoman. By accessing our website and using our services, you agree to comply with and be bound by the following terms and conditions of use.
          </p>

          <section className="mb-12">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing the website at <Link href="/">yorkshirebusinesswoman.co.uk</Link>, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.
            </p>
          </section>

          <section className="mb-12">
            <h2>2. Membership and Access</h2>
            <p>
              Some areas of our website are restricted to registered members. You are responsible for maintaining the confidentiality of your account information and password. We reserve the right to terminate accounts that violate our community standards or these terms.
            </p>
          </section>

          <section className="mb-12">
            <h2>3. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on Yorkshire Businesswoman&apos;s website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
            </p>
          </section>

          <section className="mb-12">
            <h2>4. Disclaimer</h2>
            <p>
              The materials on Yorkshire Businesswoman&apos;s website are provided on an &apos;as is&apos; basis. Yorkshire Businesswoman makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section className="mb-12">
            <h2>5. Limitations</h2>
            <p>
              In no event shall Yorkshire Businesswoman or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Yorkshire Businesswoman&apos;s website.
            </p>
          </section>

          <section className="mb-12">
            <h2>6. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of United Kingdom and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

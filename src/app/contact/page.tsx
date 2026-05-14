import { getPage } from '@/lib/ghost';
import Image from 'next/image';
import { ModernContactForm } from '@/components/ModernContactForm';

export const revalidate = 3600;

export default async function ContactPage() {
  const page = await getPage('contact');

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent" />
          <div className="absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full bg-accent" />
        </div>
        <div className="relative flex flex-col justify-center px-12 xl:px-20">
          <div className="max-w-md">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Get In Touch
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground xl:text-5xl">
              We&apos;d love to hear from you
            </h1>
            <p className="mt-6 text-primary-foreground/70 leading-relaxed">
              Have a question about membership, our magazine, or upcoming events? Our team is here to help you connect and grow.
            </p>
            
            <div className="mt-12 space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Email Us</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60">
                    <a href="mailto:editor@yorkshirebusinesswoman.co.uk" className="hover:text-accent transition-colors">
                      editor@yorkshirebusinesswoman.co.uk
                    </a>
                  </p>
                  <p className="text-sm text-primary-foreground/60">
                    <a href="mailto:dd@yorkshirebusinesswoman.co.uk" className="hover:text-accent transition-colors">
                      dd@yorkshirebusinesswoman.co.uk
                    </a>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Call Us</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60">
                    <a href="tel:+447711539047" className="hover:text-accent transition-colors">
                      +44 (0) 7711 539047
                    </a>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Based In</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60">Yorkshire, United Kingdom</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-12 xl:px-20 bg-background">
        <div className="mx-auto w-full max-w-lg">
          {/* Mobile header */}
          <div className="lg:hidden mb-10 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Get In Touch
            </span>
            <h1 className="mt-2 font-serif text-3xl font-medium text-foreground">
              Contact Us
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We&apos;d love to hear from you
            </p>
          </div>

          <ModernContactForm />

          {/* Render Ghost Content below the form if it exists */}
          {page?.html && (
            <div className="mt-16 pt-12 border-t border-border">
              {page.feature_image && (
                <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-xl">
                  <Image
                    src={page.feature_image}
                    alt={page.title}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              )}
              
              <div 
                className="prose prose-lg max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: page.html }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

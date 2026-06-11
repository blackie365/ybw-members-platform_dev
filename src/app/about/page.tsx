import { getPage } from '@/lib/ghost';
import { sanitizeHtml } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Quote, Users, BookOpen, Calendar, Award, Sparkles, Heart } from 'lucide-react';

export const revalidate = 3600;

const stats = [
  { label: 'Members', value: '200+', icon: Users },
  { label: 'Articles Published', value: '1,200+', icon: BookOpen },
  { label: 'Events Hosted', value: '150+', icon: Calendar },
  { label: 'Years Empowering Women', value: '15+', icon: Award },
];

const testimonials = [
  {
    quote: "Yorkshire Businesswoman has been instrumental in my journey as an entrepreneur. The connections I&apos;ve made and the knowledge I&apos;ve gained have been invaluable.",
    author: "Sarah Mitchell",
    role: "Founder, Mitchell & Co",
    image: "/images/testimonials/sarah.jpg",
  },
  {
    quote: "Being featured in the magazine opened doors I never thought possible. The community here truly champions women&apos;s success.",
    author: "Emma Richardson",
    role: "CEO, Northern Tech Solutions",
    image: "/images/testimonials/emma.jpg",
  },
  {
    quote: "The events and networking opportunities have transformed my business. I&apos;ve found mentors, partners, and lifelong friends.",
    author: "Claire Thompson",
    role: "Director, Thompson Legal",
    image: "/images/testimonials/claire.jpg",
  },
];

const values = [
  {
    title: 'Empowerment',
    description: 'We believe in lifting each other up and creating opportunities for women to thrive in business.',
    icon: Sparkles,
  },
  {
    title: 'Community',
    description: 'Building genuine connections that go beyond networking - creating a supportive sisterhood.',
    icon: Heart,
  },
  {
    title: 'Excellence',
    description: 'Celebrating and showcasing the remarkable achievements of Yorkshire&apos;s businesswomen.',
    icon: Award,
  },
];

export default async function AboutPage() {
  const page = await getPage('about');

  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-primary py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/15 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-6">
              Est. 2009
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl text-balance">
              Championing Yorkshire&apos;s <span className="text-accent">Extraordinary</span> Businesswomen
            </h1>
            <p className="mt-8 text-lg text-primary-foreground/70 max-w-2xl mx-auto leading-relaxed">
              For over 15 years, we&apos;ve been the voice of ambitious women across Yorkshire, 
              celebrating success stories and building a community that inspires, connects, and empowers.
            </p>
          </div>
        </div>
      </section>
      {/* Stats Section */}
      <section className="relative -mt-12 z-10">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats?.map((stat) => (
              <div 
                key={stat?.label}
                className="bg-card border border-border rounded-lg p-6 text-center hover:border-accent/30 transition-colors"
              >
                <stat.icon className="w-6 h-6 text-accent mx-auto mb-3" />
                <p className="font-serif text-3xl font-medium text-foreground">{stat?.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat?.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Story Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-4">
                Our Story
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
                More Than a Magazine
              </h2>
              <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
                <p>
                  Yorkshire Businesswoman began with a simple belief: that the remarkable women 
                  building businesses across our region deserved a platform to share their stories, 
                  connect with peers, and inspire the next generation.
                </p>
                <p>
                  What started as a quarterly publication has grown into a thriving community 
                  of over 200 members, encompassing entrepreneurs, executives, creatives, 
                  and change-makers from every industry imaginable.
                </p>
                <p>
                  Today, we&apos;re proud to be Yorkshire&apos;s leading business publication for women, 
                  offering not just inspiring content, but meaningful connections through our 
                  events, membership benefits, and digital platform.
                </p>
              </div>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link 
                  href="/membership"
                  className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors"
                >
                  Join Our Community
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link 
                  href="/contact"
                  className="inline-flex items-center gap-2 border border-border bg-card text-foreground px-6 py-3 rounded-lg font-medium hover:border-accent/30 transition-colors"
                >
                  Get in Touch
                </Link>
              </div>
            </div>
            <div className="relative">
              {page?.feature_image ? (
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden">
                  <Image
                    src={page?.feature_image}
                    alt={page?.title}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
                </div>
              ) : (
                <div className="aspect-[4/5] rounded-lg bg-muted flex items-center justify-center">
                  <BookOpen className="w-24 h-24 text-muted-foreground/30" />
                </div>
              )}
              {/* Decorative accent */}
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-accent/10 rounded-lg -z-10" />
              <div className="absolute -top-6 -right-6 w-24 h-24 border-2 border-accent/20 rounded-lg -z-10" />
            </div>
          </div>
        </div>
      </section>
      {/* Values Section */}
      <section className="py-24 sm:py-32 bg-secondary/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-4">
              What We Stand For
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
              Our Values
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {values?.map((value) => (
              <div 
                key={value?.title}
                className="bg-card border border-border rounded-lg p-8 text-center hover:border-accent/30 transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <value.icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="font-serif text-xl font-medium text-foreground mb-3">
                  {value?.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {value?.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Testimonials Section */}
      <section className="py-24 sm:py-32 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-4">
              Member Stories
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight">
              What Our Community Says
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials?.map((testimonial, index) => (
              <div 
                key={index}
                className="relative bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 rounded-lg p-8"
              >
                <Quote className="w-10 h-10 text-accent/40 mb-6" />
                <blockquote className="text-primary-foreground/90 leading-relaxed mb-8">
                  {testimonial?.quote}
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="font-serif text-lg font-medium text-accent">
                      {testimonial?.author?.split(' ')?.map(n => n?.[0])?.join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-primary-foreground">{testimonial?.author}</p>
                    <p className="text-sm text-primary-foreground/60">{testimonial?.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Ghost CMS Content (if any additional content) */}
      {page?.html && page?.html?.trim() !== '' && (
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <div 
                className="prose prose-lg max-w-none
                  prose-headings:font-serif prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-foreground
                  prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-ul:text-muted-foreground prose-ol:text-muted-foreground
                  prose-blockquote:border-l-accent prose-blockquote:text-muted-foreground prose-blockquote:italic
                  prose-img:rounded-lg"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(page?.html || '') }}
              />
            </div>
          </div>
        </section>
      )}
      {/* CTA Section */}
      <section className="py-24 sm:py-32 bg-secondary/50">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-4">
            Ready to Join?
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
            Become Part of Something Extraordinary
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Join Yorkshire&apos;s most inspiring community of businesswomen. 
            Gain access to exclusive content, events, networking opportunities, and more.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link 
              href="/membership"
              className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-8 py-4 rounded-lg font-medium hover:bg-accent/90 transition-colors"
            >
              Explore Membership
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/events"
              className="inline-flex items-center gap-2 border border-border bg-card text-foreground px-8 py-4 rounded-lg font-medium hover:border-accent/30 transition-colors"
            >
              Upcoming Events
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

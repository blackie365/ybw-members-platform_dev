/**
 * SITE CONTENT HUB
 * 
 * This file centralizes all text content for the Yorkshire BusinessWoman platform.
 * Use this file to modify headlines, descriptions, and other site-wide text.
 */

export const siteContent = {
  // ==========================================
  // GLOBAL NAVIGATION & BRANDING
  // ==========================================
  global: {
    brandName: "Yorkshire BusinessWoman",
    tagline: "Empowering businesswomen across Yorkshire with networking, support, and recognition.",
    metaTitle: "Yorkshire BusinessWoman | Member & Partner Portal",
    metaDescription: "Join Yorkshire BusinessWoman - the premier network for ambitious businesswomen across Yorkshire. Access exclusive benefits, discounts, networking events, and the prestigious YBW Awards.",
    contact: {
      email: "editor@yorkshirebusinesswoman.co.uk",
      phone: "0113 123 4567",
      address: "10 Shetland Drive, Congleton, England, CW12 4FN",
    },
    navigation: [
      { name: 'Membership', href: '/membership' },
      { name: 'Partnership', href: '/partnership' },
      { name: 'YBW Awards', href: '/awards' },
      { name: 'Benefits', href: '/benefits' },
      { name: 'Magazine', href: '/magazine' },
    ],
    auth: {
      signIn: "Sign In",
      joinNow: "Join Now",
    }
  },

  // ==========================================
  // HOMEPAGE (app/page.tsx)
  // ==========================================
  home: {
    hero: {
      badge: "Yorkshire's Premier Business Network",
      headline: {
        line1: "Empowering",
        line2: "Ambitious",
        line3: "Businesswomen",
      },
      description: "Join a thriving community. Access exclusive networking events, partner discounts, and recognition at the prestigious YBW Awards.",
      ctaPrimary: "Join the Network",
      ctaSecondary: "View Benefits",
    },
    stats: [
      { value: 500, label: "Active Members", suffix: "+" },
      { value: 50, label: "Partner Brands", suffix: "+" },
      { value: 12, label: "Award Categories", suffix: "" },
      { value: 100, label: "Annual Events", suffix: "+" },
    ],
    benefitsSummary: {
      headline: "Everything You Need to Thrive",
      description: "YBW provides the platform, connections, and support you need to elevate your business and career.",
      items: [
        {
          title: 'Powerful Networking',
          description: 'Connect with ambitious businesswomen across Yorkshire at exclusive events.',
        },
        {
          title: 'Exclusive Discounts',
          description: 'Access member-only discounts from our partner businesses.',
        },
        {
          title: 'YBW Awards',
          description: 'Be recognised at the prestigious annual Yorkshire BusinessWoman Awards.',
        },
        {
          title: 'Business Growth',
          description: 'Masterclasses, mentoring, and speaking opportunities.',
        },
      ]
    },
    testimonials: {
      headline: "Member Success Stories",
      items: [
        {
          quote: "I still cannot say enough great things about this group and I’m so grateful that I am a part of such an outstanding community of incredible women!",
          author: "Zoe Hands",
          role: "Member, Yorkshire BusinessWoman",
          avatar: "https://yorkshirebusinesswoman.co.uk/images/testimonials/zoe-hands.png",
        },
        {
          quote: "I joined whilst we were in Lock Down and it was the community and support network that inspired me to join.",
          author: "Fiona Ibbetson",
          role: "Member for five years, Yorkshire BusinessWoman",
          avatar: "https://storage.googleapis.com/newmembersdirectory130325.firebasestorage.app/members/GhYFbFkADwz59Af88nHq/avatar-1770214197148-thumb.jpg",
        },
        {
          quote: "The support and mentorship from fellow members helped me scale my business beyond what I thought possible.",
          author: "Emma Richardson",
          role: "Managing Director, Yorkshire Creative Agency",
          avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&q=80",
        },
      ]
    }
  },

  // ==========================================
  // AWARDS PAGE (app/awards/page.tsx)
  // ==========================================
  awards: {
    hero: {
      badge: "Annual Celebration",
      headline: "The Yorkshire BusinessWoman Awards 2026",
      description: "Celebrating excellence, innovation, and leadership among businesswomen across Yorkshire. Join us for the region's most prestigious business awards ceremony.",
      ctaPrimary: "Nominate Someone",
      ctaSecondary: "Become a Member",
      dateLabel: "Save the Date",
      dateValue: "September 2026",
      videoPlaybackId: "MrktTslTJ1FnWKXhUceqsPlNDFgCU2KhT49cf/iT/a4P0jlFyFcnD0WRPNIf6UPcPmfQmzVe7Vl", // Latest Awards Highlights
      videoTitle: "2024 Awards Highlights",
    },
    categories: {
      headline: "Award Categories",
      description: "Recognising excellence across 12 categories, celebrating the diverse achievements of businesswomen throughout Yorkshire.",
      items: [
        'Businesswoman of the Year',
        'Entrepreneur of the Year',
        'Rising Star',
        'Innovation Award',
        'Community Champion',
        'Leadership Excellence',
        'Small Business of the Year',
        'Digital Pioneer',
        'Sustainability Champion',
        'Mentor of the Year',
        'Customer Service Excellence',
        'Lifetime Achievement',
      ]
    },
    timeline: {
      headline: "Awards Timeline",
      description: "From nominations to the gala ceremony, here's how the awards journey unfolds.",
      items: [
        {
          date: 'September-December',
          title: 'Nominations Open',
          description: 'Members can nominate outstanding businesswomen across all categories.',
        },
        {
          date: 'January',
          title: 'Shortlisting',
          description: 'Our judging panel reviews nominations and creates the shortlist.',
        },
        {
          date: 'March',
          title: 'Awards Gala',
          description: 'Winners announced at our prestigious black-tie ceremony.',
        },
      ]
    },
    memberBenefits: {
      headline: "Member Benefits at the Awards",
      description: "As a YBW member, you have exclusive access to participate in the awards process and attend the prestigious gala ceremony.",
      items: [
        { tier: 'Standard', benefit: 'Voting rights for all categories' },
        { tier: 'Premium', benefit: 'Nomination rights + discounted gala tickets' },
        { tier: 'VIP', benefit: 'Judging panel access + VIP gala seating' },
      ]
    }
  },

  // ==========================================
  // MEMBERSHIP PAGE (app/membership/page.tsx)
  // ==========================================
  membership: {
    hero: {
      badge: "Membership Plans",
      headline: "Choose Your YBW Membership",
      description: "Unlock exclusive benefits, networking opportunities, and recognition. Find the perfect membership tier to match your business ambitions.",
    },
    faq: {
      headline: "Frequently Asked Questions",
      description: "Got questions about membership? We've got answers.",
      items: [
        {
          q: 'Can I upgrade my membership later?',
          a: 'Yes! You can upgrade to a higher tier at any time. We\'ll prorate the difference based on your remaining membership period.',
        },
        {
          q: 'What payment methods do you accept?',
          a: 'We accept all major credit and debit cards through our secure Stripe payment system.',
        },
        {
          q: 'Is there a refund policy?',
          a: 'We offer a 30-day money-back guarantee if you\'re not completely satisfied with your membership.',
        },
        {
          q: 'How do I access member discounts?',
          a: 'Once you\'re a member, you\'ll have access to our partner discount directory in your dashboard with exclusive codes and offers.',
        },
        {
          q: 'Can my business partner also access my membership?',
          a: 'Memberships are individual. However, our Partnership program is designed for businesses looking to engage with the YBW community.',
        },
      ]
    },
    cta: {
      headline: "Not Sure Which Plan is Right?",
      description: "Contact us for a personalised recommendation based on your business needs and goals.",
    }
  },

  // ==========================================
  // PARTNERSHIP PAGE (app/partnership/page.tsx)
  // ==========================================
  partnership: {
    hero: {
      badge: "Partnership Opportunities",
      headline: "Partner With Yorkshire BusinessWoman",
      description: "Align your brand with Yorkshire's premier business network. Reach influential businesswomen and demonstrate your commitment to supporting women in business.",
      ctaPrimary: "Become a Partner",
      ctaSecondary: "Enquire Now",
    },
    benefits: {
      headline: "Why Partner With YBW?",
      description: "Position your business at the heart of Yorkshire's business community.",
      items: [
        {
          title: 'Access to 500+ Members',
          description: 'Connect your brand with ambitious businesswomen across Yorkshire.',
        },
        {
          title: 'Marketing Exposure',
          description: 'Featured placement across our website, newsletter, and social channels.',
        },
        {
          title: 'YBW Awards Sponsorship',
          description: 'Associate your brand with excellence at our prestigious annual awards.',
        },
      ]
    },
    testimonial: {
      quote: "Partnering with YBW has been transformative for our business. The exposure to Yorkshire's business community and the quality of connections made have exceeded all expectations.",
      author: "Amanda Clarke",
      role: "Marketing Director, Clarke Financial Services",
    },
    cta: {
      headline: "Ready to Partner?",
      description: "Have questions about partnership opportunities? Our team is here to help you find the perfect fit for your business.",
    }
  },

  // ==========================================
  // BENEFITS PAGE (app/benefits/page.tsx)
  // ==========================================
  benefits: {
    hero: {
      badge: "Member Benefits",
      headline: "Exclusive Member Benefits",
      description: "From networking events to partner discounts, discover everything that makes YBW membership invaluable for your business growth.",
    },
    items: [
      {
        title: 'Networking Events',
        description: 'Monthly networking sessions, breakfast meetings, and exclusive member mixers across Yorkshire.',
        features: ['Monthly meetups', 'Industry-specific groups', 'Online networking'],
      },
      {
        title: 'Partner Discounts',
        description: 'Access exclusive discounts from 50+ partner businesses - from legal services to marketing.',
        features: ['10-30% savings', 'Local businesses', 'Premium services'],
      },
      {
        title: 'Masterclasses',
        description: 'Learn from industry experts with workshops on leadership, marketing, finance, and more.',
        features: ['Expert speakers', 'Practical skills', 'Recorded sessions'],
      },
      {
        title: 'Speaking Opportunities',
        description: 'Share your expertise and raise your profile with speaking slots at YBW events.',
        features: ['Raise your profile', 'Media exposure', 'Podcast features'],
      },
      {
        title: 'YBW Awards',
        description: 'Nominate, vote, and be recognised at Yorkshire\'s premier business awards.',
        features: ['12 categories', 'Gala ceremony', 'Industry recognition'],
      },
      {
        title: 'Business Support',
        description: 'Access mentoring, coaching, and peer support from successful businesswomen.',
        features: ['Mentoring scheme', '1-to-1 coaching', 'Peer groups'],
      },
    ],
    directory: {
      badge: "50+ Partners",
      headline: "Partner Discount Directory",
      description1: "Our partner businesses offer exclusive discounts to YBW members, helping you save money while supporting fellow businesswomen and local enterprises.",
      description2: "Many members report saving more than their membership fee through partner discounts alone - making YBW membership effectively free!",
      categories: [
        'Legal Services', 'Accountancy', 'Marketing & PR', 'Web & Digital',
        'HR & Recruitment', 'Wellness & Fitness', 'Training & Development',
        'Office Services', 'Photography', 'Business Coaching',
        'Financial Services', 'Travel & Hospitality',
      ]
    },
    comparison: {
      headline: "Benefits by Membership Tier",
      description: "Higher tiers unlock additional benefits and exclusive opportunities.",
    }
  },

  // ==========================================
  // CONTACT PAGE (app/contact/page.tsx)
  // ==========================================
  contact: {
    hero: {
      badge: "Get in Touch",
      headline: "Contact Yorkshire BusinessWoman",
      description: "Have a question or want to learn more? We'd love to hear from you. Email us at editor@yorkshirebusinesswoman.co.uk",
    },
    info: {
      email: { title: "Email Us", value: "editor@yorkshirebusinesswoman.co.uk" },
      phone: { title: "Call Us", value: "0113 123 4567" },
      address: { title: "Visit Us", value: "10 Shetland Drive, Congleton, England, CW12 4FN" },
      response: { title: "Response Time", value: "We typically respond within 24 hours" },
    },
    form: {
      headline: "Send Us a Message",
      description: "Fill out the form below and we'll get back to you as soon as possible.",
      success: {
        headline: "Message Sent!",
        description: "Thank you for contacting us. We'll be in touch soon.",
        cta: "Send Another Message",
      },
      labels: {
        name: "Your Name *",
        email: "Email Address *",
        subject: "Subject *",
        message: "Your Message *",
      },
      placeholders: {
        name: "Jane Smith",
        email: "you@example.com",
        subject: "Select a subject",
        message: "How can we help you?",
      }
    }
  },

  // ==========================================
  // MAGAZINE (app/magazine/page.tsx)
  // ==========================================
  magazine: {
    hero: {
      badge: "Digital Library",
      headline: "The Magazine",
      description: "Access our exclusive collection of Yorkshire BusinessWoman digital editions. Inspiring stories, expert insights, and regional highlights at your fingertips.",
    },
    issues: [
      {
        id: "issue-apr-may-2026",
        title: "April / May 2026",
        coverImage: "https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/magazine%2Fapr-may-2026%2Fcover.jpg?alt=media",
        publishDate: "2026-04-01",
        description: "The Winner of YBW Awards 2026: Lesley Beach. Featuring the Big Interview with Dame Linda Pollard & Vicky Cheetham, and bespoke fashion with Rebecca Rhoades.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_april-may_2026&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_april-may_2026.pdf",
        isLatest: true,
        tags: ["Awards 2026", "Leadership", "Bespoke Fashion"]
      },
      {
        id: "ybw_feb_2026",
        title: "February / March 2026",
        coverImage: "https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=2670&auto=format&fit=crop",
        publishDate: "2026-02-01",
        description: "The Wellness Issue: Balancing ambition with self-care, and the future of work-life integration.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_feb_2026&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_feb_2026.pdf",
        isLatest: false,
        tags: ["Wellness", "Future of Work"]
      },
      {
        id: "ybw_dec_2025",
        title: "December 2025 / January 2026",
        coverImage: "https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2670&auto=format&fit=crop",
        publishDate: "2025-12-01",
        description: "The Christmas Edition: Celebrating a year of excellence and looking forward to 2026.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_dec_2025&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_dec_2025.pdf",
        isLatest: false,
        tags: ["Christmas", "Review"]
      },
      {
        id: "ybw_oct_2025",
        title: "October / November 2025",
        coverImage: "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?q=80&w=2669&auto=format&fit=crop",
        publishDate: "2025-10-01",
        description: "The Innovation Issue: How Yorkshire businesswomen are leading the digital transformation.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_oct_2025&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_oct_2025.pdf",
        isLatest: false,
        tags: ["Innovation", "Technology"]
      },
      {
        id: "ybw_aug_2025",
        title: "August / September 2025",
        coverImage: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2670&auto=format&fit=crop",
        publishDate: "2025-08-01",
        description: "The Summer Edition: Highlights from the Great Yorkshire Show and seasonal business trends.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_aug_2025&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_aug_2025.pdf",
        isLatest: false,
        tags: ["Summer", "Great Yorkshire Show"]
      },
      {
        id: "ybw_jun_2025",
        title: "June / July 2025",
        coverImage: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=2574&auto=format&fit=crop",
        publishDate: "2025-06-01",
        description: "The Growth Issue: Strategies for scaling your business in the second half of the year.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_jun_2025&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_jun_2025.pdf",
        isLatest: false,
        tags: ["Growth", "Strategy"]
      },
      {
        id: "ybw_apr_2025",
        title: "April / May 2025",
        coverImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2671&auto=format&fit=crop",
        publishDate: "2025-04-01",
        description: "Spring Awakening: New beginnings and fresh perspectives for Yorkshire's entrepreneurs.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_apr_2025&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_apr_2025.pdf",
        isLatest: false,
        tags: ["Spring", "Entrepreneurship"]
      },
      {
        id: "ybw_feb_2025",
        title: "February / March 2025",
        coverImage: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2400&auto=format&fit=crop",
        publishDate: "2025-02-01",
        description: "The Resilience Issue: Overcoming challenges and building robust business models.",
        pdfUrl: "https://e.issuu.com/embed.html?d=ybw_feb_2025&u=blackie365",
        downloadUrl: "https://yorkshirebusinesswoman.co.uk/downloads/ybw_feb_2025.pdf",
        isLatest: false,
        tags: ["Resilience", "Leadership"]
      }
    ],
    cta: {
      text: "Join the Community",
      link: "/membership"
    }
  },

  // --- PREMIUM DIGITAL MAGAZINE PAGES ---
  magazinePages: [
    // Page 1: Cover
    {
      id: 1,
      type: 'cover',
      content: {
        title: "Yorkshire BusinessWoman",
        headline: "The Winner of YBW Awards 2026: Lesley Beach",
        subheadline: "Celebrating excellence, innovation, and leadership among businesswomen across Yorkshire.",
        date: "April / May 2026",
        issue: "No. 43",
        image: "https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/magazine%2Fapr-may-2026%2Fcover.jpg?alt=media"
      }
    },
    // Page 2: Editor's Note
    {
      id: 2,
      type: 'editorial',
      content: {
        title: "Welcome to the April/May Edition",
        author: "Gill Laidler",
        role: "Editor-in-Chief",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
        text: "Welcome to this edition of Yorkshire Businesswoman magazine where we have a special feature and round-up from the Yorkshire Businesswoman awards that took place last month. Once again, I would like to thank all our sponsors, partners and of course the committee for their support.",
        quote: "True leadership is about creating a space where others can flourish."
      }
    },
    // Page 3: Contents & News
    {
      id: 3,
      type: 'contents',
      content: {
        items: [
          { page: "04", title: "The Big Interview: Dame Linda Pollard & Vicky Cheetham", category: "Cover Story" },
          { page: "08", title: "Bespoke Fashion with Rebecca Rhoades", category: "Lifestyle" },
          { page: "12", title: "Member Profile: Vicky Clapham, Bevic Marketing", category: "Community" },
          { page: "16", title: "Dining Review: Ambers Restaurant, Harrogate", category: "Expert Insight" }
        ],
        news: [
          "Lesley Beach wins YBW Awards 2026",
          "Hot Flash: New Yorkshire film featuring Gaynor Faye",
          "New Yorkshire Film company fronted by Katherine Kelly"
        ]
      }
    },
    // Page 4: Feature Spread (Left)
    {
      id: 4,
      type: 'feature-left',
      content: {
        title: "The Big Interview",
        name: "Dame Linda Pollard & Vicky Cheetham",
        image: "https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/magazine%2Fapr-may-2026%2Flinda-vicky.jpg?alt=media",
        intro: "Leeds Heritage Theatres (LHT) is delighted to announce two new appointments, Dame Dr Linda Pollard DBE DL Hon LLD as its next chair of the board of trustees, and Vicky Cheetham as chief executive."
      }
    },
    // Page 5: Feature Spread (Right)
    {
      id: 5,
      type: 'feature-right',
      content: {
        quote: "I am absolutely delighted to be joining Leeds Heritage Theatres at such an exciting time in its journey.",
        text: "Dame Linda brings exceptional experience in leadership, governance, and public service. Vicky Cheetham, who is married with three daughters, brings a wealth of experience from the Barbican, Southbank Centre, and Tate.",
        stats: [
          { label: "Turnover", value: "£1.9B" },
          { label: "Staff", value: "22k" },
          { label: "Venues", value: "3" }
        ]
      }
    },
    // Page 6: Expert Column
    {
      id: 6,
      type: 'column',
      content: {
        title: "It's not you, it's the clothes...",
        author: "Rebecca Rhoades",
        category: "Bespoke Fashion",
        text: "There’s something about wearing something that’s been made just for you that just hits differently. Not in a loud, over-the-top way, but in a quiet confidence way. You stand differently, you feel more like yourself.",
        tips: [
          "Invest in one piece that fits properly.",
          "Bespoke isn't just for big occasions.",
          "Everything is designed around you."
        ]
      }
    },
    // Page 7: Lifestyle & Wellness
    {
      id: 7,
      type: 'lifestyle',
      content: {
        title: "Heritage Meets Modern Elegance",
        image: "https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/magazine%2Fapr-may-2026%2Fambers.jpg?alt=media",
        text: "Set within the stately surroundings of the historic Cedar Court Hotel in Harrogate, Ambers Restaurant is a polished addition to Harrogate’s dining scene...",
        highlights: ["Locally sourced Yorkshire produce", "Heritage meets modern elegance", "Lady Amber Fitzwilliam inspiration"]
      }
    },
    // Page 8: Member Spotlight
    {
      id: 8,
      type: 'spotlight',
      content: {
        name: "Vicky Clapham",
        role: "Managing Director, Bevic Marketing",
        image: "https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/magazine%2Fapr-may-2026%2Fvicky-clapham.jpg?alt=media",
        bio: "Vicky studied English Literature and Language at Newcastle University. Today, as the founder of Bevic Marketing and PR Services, she helps businesses find and share their stories.",
        message: "Never underestimate the power of your story. It can inspire and connect."
      }
    },
    // Page 9: Partnership Feature
    {
      id: 9,
      type: 'partner',
      content: {
        brand: "Yorkshire Businesswoman",
        headline: "Why You Should Become a Member",
        image: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
        offer: "Access exclusive online member area and WhatsApp group."
      }
    },
    // Page 10: Back Cover
    {
      id: 10,
      type: 'back-cover',
      content: {
        title: "Yorkshire BusinessWoman",
        cta: "Join the Community",
        nextIssue: "June / July 2026",
        socials: ["Instagram", "LinkedIn", "X"]
      }
    }
  ]
} as const;

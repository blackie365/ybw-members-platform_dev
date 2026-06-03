/**
 * Yorkshire BusinessWoman - Editorial Design System
 * 
 * Centralized design tokens for consistent, high-end magazine aesthetics.
 */

export const MAGAZINE_THEME = {
  colors: {
    primary: '#050505', // Deep rich black
    accent: '#a3413a',  // Yorkshire Brick Red
    surface: '#FAF9F6', // Off-white / Eggshell
    text: {
      main: '#18181B',
      muted: '#71717A',
      light: '#FFFFFF'
    }
  },
  fonts: {
    serif: 'var(--font-playfair), serif', // High-end headlines
    sans: 'var(--font-inter), sans-serif', // Clean body text
    mono: 'var(--font-space-mono), monospace' // Editorial details (dates, issue #)
  },
  layouts: {
    margins: 'p-12 md:p-24',
    grid: 'grid lg:grid-cols-2 gap-20'
  }
};

export type MagazineTemplateId = 
  | 'cover' 
  | 'editorial' 
  | 'contents' 
  | 'feature-left' 
  | 'feature-right' 
  | 'column' 
  | 'lifestyle' 
  | 'spotlight' 
  | 'partner' 
  | 'back-cover';

export interface MagazineTemplate {
  id: MagazineTemplateId;
  name: string;
  description: string;
  category: 'structural' | 'content' | 'feature';
  fields: {
    name: string;
    key: string;
    type: 'text' | 'textarea' | 'image' | 'list' | 'stats';
    required: boolean;
  }[];
}

export const MAGAZINE_TEMPLATES: MagazineTemplate[] = [
  {
    id: 'cover',
    name: 'Main Cover',
    description: 'The front face of the edition with headline and date.',
    category: 'structural',
    fields: [
      { name: 'Issue Title', key: 'title', type: 'text', required: true },
      { name: 'Main Headline', key: 'headline', type: 'text', required: true },
      { name: 'Subheadline', key: 'subheadline', type: 'textarea', required: false },
      { name: 'Date', key: 'date', type: 'text', required: true },
      { name: 'Issue No.', key: 'issue', type: 'text', required: true },
      { name: 'Cover Image', key: 'image', type: 'image', required: true },
    ]
  },
  {
    id: 'editorial',
    name: 'Editor\'s Note',
    description: 'Personal message with portrait and signature quote.',
    category: 'structural',
    fields: [
      { name: 'Title', key: 'title', type: 'text', required: true },
      { name: 'Author', key: 'author', type: 'text', required: true },
      { name: 'Role', key: 'role', type: 'text', required: true },
      { name: 'Editor Image', key: 'image', type: 'image', required: true },
      { name: 'Main Text', key: 'text', type: 'textarea', required: true },
      { name: 'Signature Quote', key: 'quote', type: 'text', required: false },
    ]
  },
  {
    id: 'contents',
    name: 'Table of Contents',
    description: 'Overview of the current issue with regional news.',
    category: 'structural',
    fields: [
      { name: 'Items', key: 'items', type: 'list', required: true },
      { name: 'Regional News', key: 'news', type: 'list', required: false },
    ]
  },
  {
    id: 'feature-left',
    name: 'Hero Spread (Left)',
    description: 'Full-height image on the left, big title on the right.',
    category: 'feature',
    fields: [
      { name: 'Subject Name', key: 'name', type: 'text', required: true },
      { name: 'Short Title', key: 'title', type: 'text', required: true },
      { name: 'Intro Text', key: 'textarea', type: 'textarea', required: true },
      { name: 'Hero Image', key: 'image', type: 'image', required: true },
    ]
  },
  {
    id: 'feature-right',
    name: 'Hero Quote (Right)',
    description: 'Big quote and snapshot stats with faded background.',
    category: 'feature',
    fields: [
      { name: 'Main Quote', key: 'quote', type: 'textarea', required: true },
      { name: 'Main Text', key: 'text', type: 'textarea', required: true },
      { name: 'Snapshot Stats', key: 'stats', type: 'stats', required: false },
      { name: 'Background Image', key: 'image', type: 'image', required: false },
    ]
  },
  {
    id: 'column',
    name: 'Expert Column',
    description: 'Deep-dive article with author profile and takeaways.',
    category: 'content',
    fields: [
      { name: 'Article Title', key: 'title', type: 'text', required: true },
      { name: 'Author Name', key: 'author', type: 'text', required: true },
      { name: 'Category', key: 'category', type: 'text', required: true },
      { name: 'Body Text', key: 'text', type: 'textarea', required: true },
      { name: 'Key Takeaways', key: 'tips', type: 'list', required: false },
      { name: 'Header Image', key: 'image', type: 'image', required: false },
    ]
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle Spread',
    description: 'Elegant layout with side image and artistic typography.',
    category: 'content',
    fields: [
      { name: 'Main Text', key: 'text', type: 'textarea', required: true },
      { name: 'Highlights', key: 'highlights', type: 'list', required: false },
      { name: 'Lifestyle Image', key: 'image', type: 'image', required: true },
    ]
  },
  {
    id: 'spotlight',
    name: 'Member Spotlight',
    description: 'Profile feature with tilted photo and bio.',
    category: 'content',
    fields: [
      { name: 'Member Name', key: 'name', type: 'text', required: true },
      { name: 'Current Role', key: 'role', type: 'text', required: true },
      { name: 'Key Message', key: 'message', type: 'textarea', required: true },
      { name: 'Biography', key: 'bio', type: 'textarea', required: true },
      { name: 'Profile Image', key: 'image', type: 'image', required: true },
    ]
  },
  {
    id: 'partner',
    name: 'Partner Feature',
    description: 'Branded full-page feature with special offer.',
    category: 'feature',
    fields: [
      { name: 'Brand Name', key: 'brand', type: 'text', required: true },
      { name: 'Headline', key: 'headline', type: 'text', required: true },
      { name: 'Special Offer', key: 'offer', type: 'text', required: true },
      { name: 'Brand Image', key: 'image', type: 'image', required: true },
    ]
  },
  {
    id: 'back-cover',
    name: 'Back Cover',
    description: 'Closing page with next issue info and socials.',
    category: 'structural',
    fields: [
      { name: 'Next Issue Date', key: 'nextIssue', type: 'text', required: true },
      { name: 'Call to Action', key: 'cta', type: 'text', required: true },
      { name: 'Social Links', key: 'socials', type: 'list', required: false },
      { name: 'Background Image', key: 'image', type: 'image', required: false },
    ]
  }
];

/**
 * Smart Layout Logic: Maps Ghost content types to best-fit Magazine Spreads
 */
export const mapGhostToTemplate = (post: any): string => {
  const wordCount = post.html?.split(' ').length || 0;
  const hasImage = !!post.feature_image;
  const tags = post.tags?.map((t: any) => t.name.toLowerCase()) || [];

  if (tags.includes('editorial') || tags.includes('note')) return 'editorial';
  if (tags.includes('spotlight') || tags.includes('profile')) return 'spotlight';
  if (tags.includes('partner') || tags.includes('advert')) return 'partner';
  if (tags.includes('column') || tags.includes('expert')) return 'column';
  
  if (wordCount > 800) return 'feature-left'; // Very long articles deserve a full hero feature
  if (hasImage && wordCount < 300) return 'lifestyle'; // Short with image is great for lifestyle
  if (wordCount > 400) return 'column'; // Medium length works well as a column
  
  return 'column'; // Default fallback for content
};

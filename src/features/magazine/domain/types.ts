export type ReaderPageTemplate =
  | 'cover'
  | 'contents'
  | 'feature-left'
  | 'feature-right'
  | 'feature-full'
  | 'editor-note'
  | 'ad'
  | 'back-cover';

export interface ReaderPageContent {
  title: string;
  body: string;
  author?: string;
  kicker?: string;
  standfirst?: string;
  imageUrl?: string;
  imageUrls?: string[];
  quote?: string;
  pullQuotes?: string[];
  items?: Array<{ title: string; page: string }>;
  ctaLabel?: string;
  ctaHref?: string;
  label?: string;
}

export interface ReaderPage {
  id: string;
  position: number;
  template: ReaderPageTemplate;
  content: ReaderPageContent;
}

export interface ReaderEdition {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  publishDate: string;
  pageCount: number;
  pages: ReaderPage[];
  createdAt: string;
}

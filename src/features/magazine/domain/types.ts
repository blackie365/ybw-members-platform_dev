export type ReaderPageTemplate =
  | "cover"
  | "contents"
  | "feature-left"
  | "feature-right"
  | "feature-full"
  | "editor-note"
  | "ad"
  | "back-cover";

export interface ReaderPageContent {
  title: string;
  body: string;
  author?: string;
  name?: string;
  kicker?: string;
  standfirst?: string;
  imageUrl?: string;
  imageUrls?: string[];
  pdfUrl?: string;
  backgroundImage?: string;
  videoUrl?: string;
  quote?: string;
  pullQuotes?: string[];
  items?: Array<{ title: string; page: string }>;
  ctaLabel?: string;
  ctaHref?: string;
  label?: string;
  mediaLayout?: "background" | "split" | "standard" | string;
  weight?: number;
  isContinuation?: boolean;
  continuationLabel?: string;
  nextIssue?: string;
  snapshotLabel?: string;

  // ---- Canonical image aliases: set by idml-template-mapper for every page
  // so that normalizeImageFields + legacy renderers (which look for any of
  // featureImage/image/heroImage/mainImage/coverImage/photo/headshot/portrait
  // or images[]/gallery[]/additionalImages[] arrays) always resolve a hero
  // + gallery extras, regardless of which template consumes them.
  image?: string;
  featureImage?: string;
  heroImage?: string;
  mainImage?: string;
  coverImage?: string;
  photo?: string;
  headshot?: string;
  portrait?: string;
  images?: string[];
  gallery?: string[];
  additionalImages?: string[];

  // ---- Catch-all: unknown templates or CMS imports may emit arbitrary fields
  // (e.g. stats[], tips[], bio, brand, offer, news[], role). Keep strict typing
  // on the known keys above but allow forward-compatible extras without a
  // separate cast at every call site.
  [key: string]: unknown;
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

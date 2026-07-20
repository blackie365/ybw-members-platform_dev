import { 
  ImageIcon, 
  Type, 
  Layout,
  Star,
  User,
  Heart,
  Share2,
  List
} from 'lucide-react';

export const PAGE_TYPES = [
  { id: 'cover', label: 'Main Cover', icon: ImageIcon },
  { id: 'editorial', label: 'Editor\'s Note', icon: Type },
  { id: 'contents', label: 'Table of Contents', icon: List },
  { id: 'feature-left', label: 'Hero Spread (Left)', icon: Layout },
  { id: 'feature-right', label: 'Hero Quote (Right)', icon: Layout },
  { id: 'column', label: 'Expert Column', icon: Type },
  { id: 'lifestyle', label: 'Lifestyle Spread', icon: Heart },
  { id: 'spotlight', label: 'Member Spotlight', icon: User },
  { id: 'partner', label: 'Partner Feature', icon: Star },
  { id: 'full-page-ad', label: 'Full Page Ad', icon: ImageIcon },
  { id: 'back-cover', label: 'Back Cover', icon: Share2 },
];

export interface MagazinePage {
  docId: string;
  id: number;
  type: string;
  content: any;
  createdAt: string;
  updatedAt?: string;
}

export interface StoryLibraryItem {
  id: string;
  title: string;
  author?: string;
  text: string;
  includedInPremiumReader?: boolean;
  imageFileNames?: string[];
  source?: {
    type: 'idml' | 'icml' | 'xml' | 'manual';
    fileName?: string;
    path?: string;
  };
  createdAt: string;
}

export interface MagazineIssue {
  id: string;
  title: string;
  coverImage: string;
  publishDate: string;
  description: string;
  pdfUrl: string;
  downloadUrl?: string;
  isLatest: boolean;
  tags: string[];
  ghostSyncTag?: string; // New: Tag to sync articles from Ghost
  readerType?: 'custom' | 'issuu';
  autoSyncCover?: boolean;
  flipbookUrl?: string;
  featureInFlipbook?: boolean;
  storyLibrary?: StoryLibraryItem[];
}

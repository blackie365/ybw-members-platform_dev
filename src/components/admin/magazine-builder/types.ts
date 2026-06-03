import { 
  ImageIcon, 
  Type, 
  Layout
} from 'lucide-react';

export const PAGE_TYPES = [
  { id: 'cover', label: 'Cover Page', icon: ImageIcon },
  { id: 'editorial', label: 'Editor\'s Note', icon: Type },
  { id: 'contents', label: 'Contents & News', icon: Layout },
  { id: 'feature-left', label: 'Feature (Left Image)', icon: Layout },
  { id: 'feature-right', label: 'Feature (Right Image)', icon: Layout },
  { id: 'column', label: 'Expert Column', icon: Type },
  { id: 'lifestyle', label: 'Lifestyle Spread', icon: ImageIcon },
  { id: 'spotlight', label: 'Business Spotlight', icon: Layout },
  { id: 'partner', label: 'Partner Showcase', icon: Layout },
  { id: 'back-cover', label: 'Back Cover', icon: ImageIcon },
];

export interface MagazinePage {
  docId: string;
  id: number;
  type: string;
  content: any;
  createdAt: string;
  updatedAt?: string;
}

export interface MagazineIssue {
  id?: string;
  title: string;
  description: string;
  publishDate: string;
  coverImage: string;
  pdfUrl: string;
  downloadUrl?: string;
  isLatest?: boolean;
  tags?: string[];
}

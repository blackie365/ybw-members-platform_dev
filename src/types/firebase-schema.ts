export interface FirebasePost {
  id: string; // Original Ghost post ID
  slug: string;
  title: string;
  html: string;
  excerpt: string;
  feature_image: string | null;
  featured: boolean;
  visibility: 'public' | 'members' | 'paid';
  published_at: string; // ISO 8601 string
  created_at: string;
  updated_at: string;
  
  // Denormalized Relationships (NoSQL Best Practice)
  author_id: string; // Reference to authors collection
  author_name: string; // Stored here for faster UI rendering without extra queries
  author_image: string | null;
  
  tags: string[]; // Array of tag slugs for easy querying (e.g., array-contains 'business')
  primary_tag: string | null; // Slug of the primary tag
}

export interface FirebaseTag {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'internal';
  feature_image: string | null;
  count?: {
    posts: number;
  };
}

export interface FirebaseAuthor {
  id: string;
  slug: string;
  name: string;
  email: string;
  profile_image: string | null;
  bio: string | null;
  website: string | null;
}

export interface FirebaseMember {
  id: string; // Ghost Member ID (can map to Firebase Auth UID if matching emails)
  email: string;
  name: string;
  firstName: string; // Extracted from name during migration
  lastName: string;  // Extracted from name during migration
  companyName?: string; // To be filled by member in dashboard
  jobTitle?: string;    // To be filled by member in dashboard
  bio?: string;         // To be filled by member in dashboard
  profileImage?: string;
  linkedinUrl?: string; // To be filled by member in dashboard
  status: 'free' | 'paid' | 'comped';
  labels: string[]; // Array of label names from Ghost
  created_at: string;
  updated_at: string;
}

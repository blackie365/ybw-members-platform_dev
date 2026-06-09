'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';


import { getProfile } from '@/app/actions/profile';

export type MembershipTier = 'free' | 'premium' | 'founder';
export type UserRole = 'member' | 'admin' | 'super_admin';

export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
}

export interface MemberProfile {
  firstName: string;
  lastName: string;
  displayName?: string;
  email: string;
  slug: string;
  memberSlug?: string;
  companyName?: string;
  jobTitle?: string;
  bio?: string;
  website?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  profileImage?: string;
  avatarUrl?: string;
  bannerImage?: string;
  location?: string;
  industrySector?: string;
  yearsInBusiness?: number;
  companySize?: string;
  services?: string[];
  expertise?: string[];
  openToMentoring?: boolean;
  seekingMentorship?: boolean;
  openToBoardRoles?: boolean;
  status: 'active' | 'pending' | 'suspended';
  membershipTier: MembershipTier;
  role: UserRole;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing';
  isFeatured?: boolean;
  isAdmin?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: MemberProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  membershipTier: MembershipTier;
  profileCompleteness: number;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultContext: AuthContextType = {
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isPremium: false,
  membershipTier: 'free',
  profileCompleteness: 0,
  refreshProfile: async () => {},
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultContext);

export const useAuth = () => useContext(AuthContext);

// Calculate profile completeness percentage
function calculateProfileCompleteness(profile: MemberProfile | null): number {
  if (!profile) return 0;

  const requiredFields = [
    'firstName',
    'lastName',
    'email',
    'profileImage',
  ];

  const optionalFields = [
    'companyName',
    'jobTitle',
    'bio',
    'website',
    'linkedinUrl',
    'location',
    'industrySector',
  ];

  let completedRequired = 0;
  let completedOptional = 0;

  requiredFields.forEach((field) => {
    if (profile[field as keyof MemberProfile]) {
      completedRequired++;
    }
  });

  optionalFields.forEach((field) => {
    if (profile[field as keyof MemberProfile]) {
      completedOptional++;
    }
  });

  // Required fields count for 60%, optional for 40%
  const requiredScore = (completedRequired / requiredFields.length) * 60;
  const optionalScore = (completedOptional / optionalFields.length) * 40;

  return Math.round(requiredScore + optionalScore);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Clerk user to AuthUser
  useEffect(() => {
    if (isLoaded) {
      if (clerkUser) {
        setUser({
          uid: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || null,
          emailVerified: clerkUser.primaryEmailAddress?.verification.status === 'verified',
          displayName: clerkUser.fullName,
          photoURL: clerkUser.imageUrl,
        });
      } else {
        setUser(null);
      }
    }
  }, [clerkUser, isLoaded]);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const result = await getProfile(uid);

      if (result.success && result.data) {
        const data = result.data as Partial<MemberProfile>;
        // Set defaults for missing fields
        const profileData: MemberProfile = {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          displayName: data.displayName,
          email: data.email || '',
          slug: data.slug || '',
          memberSlug: data.memberSlug,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          bio: data.bio,
          website: data.website,
          linkedinUrl: data.linkedinUrl,
          twitterUrl: data.twitterUrl,
          instagramUrl: data.instagramUrl,
          profileImage: data.profileImage,
          avatarUrl: data.avatarUrl,
          bannerImage: data.bannerImage,
          location: data.location,
          industrySector: data.industrySector,
          yearsInBusiness: data.yearsInBusiness,
          companySize: data.companySize,
          services: data.services || [],
          expertise: data.expertise || [],
          openToMentoring: data.openToMentoring || false,
          seekingMentorship: data.seekingMentorship || false,
          openToBoardRoles: data.openToBoardRoles || false,
          status: data.status || 'active',
          membershipTier: data.membershipTier || 'free',
          role: data.role || 'member',
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          subscriptionStatus: data.subscriptionStatus,
          isFeatured: data.isFeatured || false,
          isAdmin: data.isAdmin || false,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt,
        };
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.uid) {
      await fetchProfile(user.uid);
    }
  }, [user, fetchProfile]);

  const handleSignOut = useCallback(async () => {
    await clerkSignOut();
    setUser(null);
    setProfile(null);
  }, [clerkSignOut]);

  useEffect(() => {
    if (!isLoaded) return;

    const uid = user?.uid;
    if (uid) {
      setLoading(true);
      fetchProfile(uid).finally(() => {
        setLoading(false);
      });
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user?.uid, isLoaded, fetchProfile]);

  const isAdmin = !!user && (
    profile?.role === 'admin' || 
    profile?.role === 'super_admin' || 
    profile?.isAdmin === true ||
    clerkUser?.publicMetadata?.isAdmin === true ||
    clerkUser?.publicMetadata?.role === 'admin' ||
    clerkUser?.publicMetadata?.role === 'super_admin'
  );
  const isPremium = !!user && (
    profile?.membershipTier === 'premium' || 
    profile?.membershipTier === 'founder' ||
    clerkUser?.publicMetadata?.isPremium === true
  );
  const profileCompleteness = calculateProfileCompleteness(profile);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isPremium,
        membershipTier: profile?.membershipTier || 'free',
        profileCompleteness,
        refreshProfile,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

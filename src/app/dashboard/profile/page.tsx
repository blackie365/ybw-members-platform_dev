'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { getProfile, updateProfile } from '@/app/actions/profile';
import { ProfileCompleteness } from '@/components/ProfileCompleteness';

const INDUSTRY_SECTORS = [
  'Accountancy & Finance',
  'Agriculture & Farming',
  'Architecture & Design',
  'Arts & Entertainment',
  'Charity & Non-Profit',
  'Construction & Property',
  'Consulting',
  'Education & Training',
  'Energy & Utilities',
  'Engineering',
  'Fashion & Beauty',
  'Financial Services',
  'Food & Beverage',
  'Healthcare',
  'Hospitality & Tourism',
  'HR & Recruitment',
  'Legal',
  'Manufacturing',
  'Marketing & PR',
  'Media & Publishing',
  'Professional Services',
  'Retail & E-commerce',
  'Technology & IT',
  'Transport & Logistics',
  'Other',
];

const COMPANY_SIZES = [
  'Just me',
  '2-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '500+ employees',
];

const EXPERTISE_OPTIONS = [
  'Business Strategy',
  'Sales & Marketing',
  'Digital Marketing',
  'Social Media',
  'Finance & Accounting',
  'HR & People',
  'Operations',
  'Leadership',
  'Product Development',
  'Technology',
  'Sustainability',
  'International Trade',
  'Legal & Compliance',
  'Fundraising',
  'Public Speaking',
  'Networking',
];

export default function DashboardProfile() {
  const { user, loading: authLoading, profile: authProfile, refreshProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [docId, setDocId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'professional' | 'social' | 'preferences'>('basic');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    jobTitle: '',
    bio: '',
    website: '',
    linkedinUrl: '',
    twitterUrl: '',
    instagramUrl: '',
    profileImage: '',
    bannerImage: '',
    location: '',
    industrySector: '',
    yearsInBusiness: '',
    companySize: '',
    services: '',
    expertise: [] as string[],
    openToMentoring: false,
    seekingMentorship: false,
    openToBoardRoles: false,
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      
      try {
        const result = await getProfile(user.uid);
        
        if (result.success && result.data) {
          setDocId(result.id || user.uid);
          const data = result.data;
          
          setFormData({
            firstName: data.firstName || data['First Name'] || '',
            lastName: data.lastName || data['Last Name'] || '',
            companyName: data.companyName || data['Company'] || '',
            jobTitle: data.jobTitle || data['Job Title'] || '',
            bio: data.bio || data['Bio'] || '',
            website: data.website || data['Website'] || '',
            linkedinUrl: data.linkedinUrl || data['LinkedIn URL'] || '',
            twitterUrl: data.twitterUrl || '',
            instagramUrl: data.instagramUrl || '',
            profileImage: data.profileImage || '',
            bannerImage: data.bannerImage || '',
            location: data.location || '',
            industrySector: data.industrySector || '',
            yearsInBusiness: data.yearsInBusiness?.toString() || '',
            companySize: data.companySize || '',
            services: Array.isArray(data.services) ? data.services.join(', ') : (data.services || ''),
            expertise: Array.isArray(data.expertise) ? data.expertise : [],
            openToMentoring: data.openToMentoring || false,
            seekingMentorship: data.seekingMentorship || false,
            openToBoardRoles: data.openToBoardRoles || false,
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadProfile();
    }
  }, [user, authLoading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleExpertiseToggle = (expertise: string) => {
    setFormData(prev => ({
      ...prev,
      expertise: prev.expertise.includes(expertise)
        ? prev.expertise.filter(e => e !== expertise)
        : [...prev.expertise, expertise],
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !user?.email) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload a valid image file.' });
      return;
    }

    const maxSize = type === 'banner' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: `Image size should be less than ${type === 'banner' ? '10MB' : '5MB'}.` });
      return;
    }

    if (type === 'profile') {
      setUploadingImage(true);
    } else {
      setUploadingBanner(true);
    }
    setMessage({ type: '', text: '' });

    try {
      const fileExtension = file.name.split('.').pop();
      const storageRef = ref(storage, `${type}-images/${user.uid || Date.now()}.${fileExtension}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on(
        'state_changed',
        () => {},
        (error) => {
          console.error('Error uploading image:', error);
          setMessage({ type: 'error', text: 'Failed to upload image. Please try again.' });
          if (type === 'profile') {
            setUploadingImage(false);
          } else {
            setUploadingBanner(false);
          }
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (type === 'profile') {
            setFormData(prev => ({ ...prev, profileImage: downloadURL }));
            setUploadingImage(false);
          } else {
            setFormData(prev => ({ ...prev, bannerImage: downloadURL }));
            setUploadingBanner(false);
          }
          setMessage({ type: 'success', text: 'Image uploaded! Remember to save your profile.' });
        }
      );
    } catch (error) {
      console.error('Error initiating upload:', error);
      setMessage({ type: 'error', text: 'Failed to initiate upload. Please try again.' });
      if (type === 'profile') {
        setUploadingImage(false);
      } else {
        setUploadingBanner(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !user?.email) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      // Convert services string to array
      const servicesArray = formData.services
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const profileData = {
        ...formData,
        services: servicesArray,
        yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : null,
      };

      const result = await updateProfile(user.uid, user.email, profileData);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Refresh the auth context profile
        await refreshProfile();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update profile. Please try again.' });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setSaving(false);
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    }
  };

  const handleBillingPortal = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email })
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: 'Failed to open billing portal.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to open billing portal.' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
    { id: 'professional', label: 'Professional', icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z' },
    { id: 'social', label: 'Social & Links', icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244' },
    { id: 'preferences', label: 'Preferences', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">My Profile</h1>
          <p className="mt-1 text-muted-foreground">
            Update your personal details and how you appear in the member directory.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleBillingPortal}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            Manage Billing
          </button>
          <a 
            href={`/members/${authProfile?.slug || docId}`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View Public Profile
          </a>
        </div>
      </div>

      {/* Profile Completeness Card */}
      <ProfileCompleteness showCTA={false} />

      {/* Messages */}
      {message.text && (
        <div className={`p-4 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Banner Image */}
        <div className="relative h-32 sm:h-48 bg-gradient-to-r from-accent/20 to-accent/5">
          {formData.bannerImage && (
            <Image
              src={formData.bannerImage}
              alt="Profile banner"
              fill
              className="object-cover"
            />
          )}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-background transition-colors"
          >
            {uploadingBanner ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                Change banner
              </>
            )}
          </button>
          <input 
            type="file" 
            ref={bannerInputRef} 
            className="hidden" 
            accept="image/png, image/jpeg, image/jpg, image/webp" 
            onChange={(e) => handleImageUpload(e, 'banner')}
          />
        </div>

        {/* Profile Image */}
        <div className="relative px-6 -mt-12 sm:-mt-16">
          <div className="flex items-end gap-4">
            <div className="relative">
              {formData.profileImage ? (
                <div className="relative h-24 w-24 sm:h-32 sm:w-32 rounded-full overflow-hidden border-4 border-card shadow-lg">
                  <Image 
                    src={formData.profileImage} 
                    alt="Profile" 
                    fill 
                    className="object-cover" 
                  />
                </div>
              ) : (
                <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-muted border-4 border-card shadow-lg flex items-center justify-center text-muted-foreground">
                  <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 rounded-full bg-accent p-2 text-accent-foreground shadow-lg hover:bg-accent/90 transition-colors"
              >
                {uploadingImage ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                )}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/jpg, image/webp" 
                onChange={(e) => handleImageUpload(e, 'profile')}
              />
            </div>
            <div className="pb-2">
              <p className="text-xs text-muted-foreground">
                JPG, PNG or WebP. Max 5MB for profile, 10MB for banner.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 mt-6 border-b border-border">
          <nav className="flex gap-6 overflow-x-auto" aria-label="Profile sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-foreground">
                    First name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-foreground">
                    Last name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-foreground">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  id="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Leeds, Yorkshire"
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-foreground">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Write a few sentences about yourself and your professional journey."
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors resize-none"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formData.bio.length}/500 characters
                </p>
              </div>
            </div>
          )}

          {/* Professional Tab */}
          {activeTab === 'professional' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-foreground">
                    Company name
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    id="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="jobTitle" className="block text-sm font-medium text-foreground">
                    Job title
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    id="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="industrySector" className="block text-sm font-medium text-foreground">
                    Industry sector
                  </label>
                  <select
                    name="industrySector"
                    id="industrySector"
                    value={formData.industrySector}
                    onChange={handleChange}
                    className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                  >
                    <option value="">Select an industry</option>
                    {INDUSTRY_SECTORS.map((sector) => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="companySize" className="block text-sm font-medium text-foreground">
                    Company size
                  </label>
                  <select
                    name="companySize"
                    id="companySize"
                    value={formData.companySize}
                    onChange={handleChange}
                    className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                  >
                    <option value="">Select company size</option>
                    {COMPANY_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-foreground">
                    Years in business
                  </label>
                  <input
                    type="number"
                    name="yearsInBusiness"
                    id="yearsInBusiness"
                    min="0"
                    max="100"
                    value={formData.yearsInBusiness}
                    onChange={handleChange}
                    className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="services" className="block text-sm font-medium text-foreground">
                  Services offered
                </label>
                <input
                  type="text"
                  name="services"
                  id="services"
                  value={formData.services}
                  onChange={handleChange}
                  placeholder="e.g. Business Coaching, Strategy Consulting, Leadership Training"
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm transition-colors"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Separate multiple services with commas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Areas of expertise
                </label>
                <div className="flex flex-wrap gap-2">
                  {EXPERTISE_OPTIONS.map((expertise) => (
                    <button
                      key={expertise}
                      type="button"
                      onClick={() => handleExpertiseToggle(expertise)}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        formData.expertise.includes(expertise)
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {formData.expertise.includes(expertise) && (
                        <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      {expertise}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Social & Links Tab */}
          {activeTab === 'social' && (
            <div className="space-y-6">
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-foreground">
                  Website
                </label>
                <div className="mt-1.5 flex rounded-lg border border-input bg-background overflow-hidden focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <span className="inline-flex items-center px-3 text-muted-foreground bg-muted text-sm border-r border-input">
                    https://
                  </span>
                  <input
                    type="text"
                    name="website"
                    id="website"
                    value={formData.website.replace(/^https?:\/\//, '')}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value ? `https://${e.target.value.replace(/^https?:\/\//, '')}` : '' }))}
                    placeholder="example.com"
                    className="block w-full bg-transparent px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="linkedinUrl" className="block text-sm font-medium text-foreground">
                  LinkedIn
                </label>
                <div className="mt-1.5 flex rounded-lg border border-input bg-background overflow-hidden focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <span className="inline-flex items-center px-3 text-muted-foreground bg-muted text-sm border-r border-input">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="linkedinUrl"
                    id="linkedinUrl"
                    value={formData.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}
                    onChange={(e) => setFormData(prev => ({ ...prev, linkedinUrl: e.target.value ? `https://linkedin.com/in/${e.target.value.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}` : '' }))}
                    placeholder="username"
                    className="block w-full bg-transparent px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="twitterUrl" className="block text-sm font-medium text-foreground">
                  X (Twitter)
                </label>
                <div className="mt-1.5 flex rounded-lg border border-input bg-background overflow-hidden focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <span className="inline-flex items-center px-3 text-muted-foreground bg-muted text-sm border-r border-input">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="twitterUrl"
                    id="twitterUrl"
                    value={formData.twitterUrl.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, '')}
                    onChange={(e) => setFormData(prev => ({ ...prev, twitterUrl: e.target.value ? `https://x.com/${e.target.value.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, '')}` : '' }))}
                    placeholder="username"
                    className="block w-full bg-transparent px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="instagramUrl" className="block text-sm font-medium text-foreground">
                  Instagram
                </label>
                <div className="mt-1.5 flex rounded-lg border border-input bg-background overflow-hidden focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <span className="inline-flex items-center px-3 text-muted-foreground bg-muted text-sm border-r border-input">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="instagramUrl"
                    id="instagramUrl"
                    value={formData.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}
                    onChange={(e) => setFormData(prev => ({ ...prev, instagramUrl: e.target.value ? `https://instagram.com/${e.target.value.replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` : '' }))}
                    placeholder="username"
                    className="block w-full bg-transparent px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium text-foreground">Opportunities & Coaching</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Let other members know how you&apos;d like to engage with the community.
                </p>
              </div>

              <div className="space-y-4">
                <label className="relative flex items-start gap-4 rounded-lg border border-input p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    name="openToMentoring"
                    checked={formData.openToMentoring}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-input text-accent focus:ring-accent/20"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Open to Coaching</span>
                    <p className="text-sm text-muted-foreground">I am available to coach other women in business.</p>
                  </div>
                </label>

                <label className="relative flex items-start gap-4 rounded-lg border border-input p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    name="seekingMentorship"
                    checked={formData.seekingMentorship}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-input text-accent focus:ring-accent/20"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Seeking a Coach</span>
                    <p className="text-sm text-muted-foreground">I am looking for guidance and coaching from experienced members.</p>
                  </div>
                </label>

                <label className="relative flex items-start gap-4 rounded-lg border border-input p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    name="openToBoardRoles"
                    checked={formData.openToBoardRoles}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-input text-accent focus:ring-accent/20"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Open to Board Roles (NED)</span>
                    <p className="text-sm text-muted-foreground">I am interested in Non-Executive Director or board opportunities.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-8 flex items-center justify-end gap-4 pt-6 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Save Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

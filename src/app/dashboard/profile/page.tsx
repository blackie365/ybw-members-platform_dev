'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { getProfile, updateProfile } from '@/app/actions/profile';

export default function DashboardProfile() {
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [docId, setDocId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    jobTitle: '',
    bio: '',
    website: '',
    linkedinUrl: '',
    profileImage: ''
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
            profileImage: data.profileImage || ''
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.email) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload a valid image file.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size should be less than 5MB.' });
      return;
    }

    setUploadingImage(true);
    setMessage({ type: '', text: '' });

    try {
      const fileExtension = file.name.split('.').pop();
      const storageRef = ref(storage, `profile-images/${user.uid || Date.now()}.${fileExtension}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Can track progress here if needed
        },
        (error) => {
          console.error('Error uploading image:', error);
          setMessage({ type: 'error', text: 'Failed to upload image. Please try again.' });
          setUploadingImage(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData(prev => ({ ...prev, profileImage: downloadURL }));
          setUploadingImage(false);
          setMessage({ type: 'success', text: 'Image uploaded! Remember to save your profile.' });
        }
      );
    } catch (error) {
      console.error('Error initiating upload:', error);
      setMessage({ type: 'error', text: 'Failed to initiate upload. Please try again.' });
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !user?.email) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const result = await updateProfile(user.uid, user.email, formData);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update profile. Please try again.' });
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setSaving(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">Please sign in to view your profile.</p>
      </div>
    );
  }

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

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 lg:p-10 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-8 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">My Profile</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Update your personal details and how you appear in the member directory.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleBillingPortal}
            disabled={loading}
            className="inline-flex justify-center items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Manage Billing'}
          </button>
          <a 
            href={`/members/${docId}`} 
            className="inline-flex justify-center items-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            View Public Profile
          </a>
        </div>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-md text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Picture Upload Section */}
        <div className="col-span-full mb-8">
          <label className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
            Profile Photo
          </label>
          <div className="mt-2 flex items-center gap-x-3">
            {formData.profileImage ? (
              <div className="relative h-20 w-20 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700">
                <Image 
                  src={formData.profileImage} 
                  alt="Profile" 
                  fill 
                  className="object-cover" 
                />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400">
                <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            )}
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="rounded-md bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm font-semibold text-zinc-900 dark:text-white shadow-sm ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              {uploadingImage ? 'Uploading...' : 'Change'}
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/png, image/jpeg, image/jpg, image/webp" 
              onChange={handleImageUpload}
            />
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            JPG, GIF or PNG. 5MB max. Square images work best.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
              First name
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="firstName"
                id="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
              Last name
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="lastName"
                id="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Company */}
          <div className="sm:col-span-2">
            <label htmlFor="companyName" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
              Company
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="companyName"
                id="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Job Title */}
          <div className="sm:col-span-2">
            <label htmlFor="jobTitle" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
              Job title
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="jobTitle"
                id="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="sm:col-span-2">
            <label htmlFor="bio" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
              Bio
            </label>
            <div className="mt-2">
              <textarea
                id="bio"
                name="bio"
                rows={4}
                value={formData.bio}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500"
                placeholder="Write a few sentences about yourself."
              />
            </div>
          </div>

          {/* Website */}
          <div className="sm:col-span-2">
            <label htmlFor="website" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
              Website URL
            </label>
            <div className="mt-2">
              <input
                type="url"
                name="website"
                id="website"
                value={formData.website}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500"
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* LinkedIn */}
          <div className="sm:col-span-2">
            <label htmlFor="linkedinUrl" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
              LinkedIn Profile
            </label>
            <div className="mt-2">
              <input
                type="url"
                name="linkedinUrl"
                id="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:focus:ring-indigo-500"
                placeholder="https://linkedin.com/in/username"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
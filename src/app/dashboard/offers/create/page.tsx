'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ImageIcon, X, Upload, Link as LinkIcon } from 'lucide-react';

export default function CreateOfferPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select an image file.');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMsg('');
    setUploadProgress(0);

    let imageUrl = '';

    try {
      // 1. Upload image if exists
      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', imageFile);
        uploadFormData.append('folder', 'offer-images');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json();
          throw new Error(uploadData.error || 'Failed to upload image');
        }

        const { url } = await uploadRes.json();
        imageUrl = url;
        setUploadProgress(100);
      }

      // 2. Submit offer
      const res = await fetch('/api/offers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          link,
          imageUrl,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName || 'Yorkshire Businesswoman Member',
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit offer');

      setStatus('success');
      setTitle('');
      setDescription('');
      setLink('');
      setImageFile(null);
      setImagePreview(null);
      
      setTimeout(() => {
        router.push('/dashboard/offers');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-none p-8 lg:p-12 shadow-sm dark:bg-zinc-950 max-w-4xl mx-auto">
      <div className="mb-8 border-b border-border pb-8">
        <h2 className="font-serif text-3xl font-medium text-foreground">Submit a Member Offer</h2>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Share exclusive discounts, perks, or opportunities with the Yorkshire Businesswoman community. Submissions are reviewed by our team before going live.
        </p>
      </div>

      {status === 'success' ? (
        <div className="text-center py-12 border border-dashed border-border bg-zinc-50 dark:bg-zinc-900/50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
            <Upload className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-serif font-medium text-foreground mb-2">Offer Submitted!</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Thank you. Your offer has been sent for review. You will be redirected shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 gap-8">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                Offer Title
              </label>
              <input
                type="text"
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-none border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
                placeholder="e.g. 20% off Coaching Sessions for YBW Members"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Offer Banner Image
              </label>
              <div className="mt-2 flex justify-center rounded-none border-2 border-dashed border-zinc-300 px-6 py-10 dark:border-zinc-700">
                {imagePreview ? (
                  <div className="relative w-full max-w-md aspect-video">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-cover rounded-none"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 transition-colors shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-zinc-300" aria-hidden="true" />
                    <div className="mt-4 flex text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer rounded-none bg-transparent font-semibold text-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 hover:text-accent/80"
                      >
                        <span>Upload a banner</span>
                        <input id="file-upload" name="file-upload" type="file" ref={fileInputRef} className="sr-only" accept="image/*" onChange={handleImageChange} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">PNG, JPG up to 10MB</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                Offer Description
              </label>
              <textarea
                id="description"
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full rounded-none border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
                placeholder="Describe the offer, how members can claim it, and any terms..."
              />
            </div>

            <div>
              <label htmlFor="link" className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Claim Link / Website (Optional)
              </label>
              <input
                type="url"
                id="link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="block w-full rounded-none border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
                placeholder="https://yourwebsite.com/bw-offer"
              />
            </div>
          </div>

          {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden dark:bg-zinc-800">
              <div 
                className="bg-accent h-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-8 py-3 text-xs font-medium uppercase tracking-wider text-foreground border border-border hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title || !description}
              className="bg-primary px-8 py-3 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Offer'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

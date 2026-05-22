'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { ImageIcon, X, Upload } from 'lucide-react';

export default function SubmitArticlePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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
    if (!user) return;

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMsg('');
    setUploadProgress(0);

    let featureImage = '';

    try {
      // 1. Upload image if exists
      if (imageFile) {
        const fileExtension = imageFile.name.split('.').pop();
        const storageRef = ref(storage, `article-images/${user.uid}-${Date.now()}.${fileExtension}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);

        featureImage = await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
      }

      // 2. Submit article
      const res = await fetch('/api/articles/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          authorName: user.displayName || 'YBW Member',
          authorEmail: user.email,
          featureImage
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit article');

      setStatus('success');
      setTitle('');
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      
      // Optionally redirect after a few seconds
      setTimeout(() => {
        router.push('/dashboard');
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
    <div className="bg-white border border-border rounded-none p-8 lg:p-12 shadow-sm dark:bg-zinc-950">
      <div className="mb-8 border-b border-border pb-8">
        <h2 className="font-serif text-3xl font-medium text-foreground">Submit an Article</h2>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Share your expertise with the Yorkshire Businesswoman community. Submitted articles are sent directly to our editorial team for review before being published.
        </p>
      </div>

      {status === 'success' ? (
        <div className="text-center py-12 border border-dashed border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="text-xl font-serif font-medium text-foreground mb-2">Article Submitted!</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Thank you. Our editorial team will review your submission shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
              Article Title
            </label>
            <input
              type="text"
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-none border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
              placeholder="e.g. 5 Leadership Lessons I Learned This Year"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Feature Image
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
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" ref={fileInputRef} className="sr-only" accept="image/*" onChange={handleImageChange} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">PNG, JPG, GIF up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-foreground mb-2">
              Article Content
            </label>
            <textarea
              id="content"
              required
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="block w-full rounded-none border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
              placeholder="Write your article here... (Markdown is supported)"
            />
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

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !title || !content}
              className="bg-primary px-8 py-3 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Upload className="w-4 h-4 animate-bounce" />
                  Submitting...
                </>
              ) : (
                'Submit to Editorial'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
'use client';

import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function ModernContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message'),
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while sending your message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto py-12">
      {/* Contact Information */}
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
            Get in Touch
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Have a question about membership, our magazine, or upcoming events? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
              <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white">Email Us</h3>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                <a href="mailto:editor@yorkshirebusinesswoman.co.uk" className="hover:text-indigo-600 dark:hover:text-indigo-400 block">
                  editor@yorkshirebusinesswoman.co.uk
                </a>
                <a href="mailto:dd@yorkshirebusinesswoman.co.uk" className="hover:text-indigo-600 dark:hover:text-indigo-400 block mt-1">
                  dd@yorkshirebusinesswoman.co.uk
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
              <Phone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white">Call Us</h3>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                <a href="tel:+447711539047" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  +44 (0) 7711 539047
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        {isSubmitted ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-semibold text-zinc-900 dark:text-white">Message Sent!</h3>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-sm">
              Thank you for reaching out. A member of our team will get back to you as soon as possible.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setIsSubmitted(false)}
              className="mt-4"
            >
              Send another message
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" required placeholder="Jane" className="bg-zinc-50 dark:bg-zinc-800/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" required placeholder="Doe" className="bg-zinc-50 dark:bg-zinc-800/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" required placeholder="jane@company.com" className="bg-zinc-50 dark:bg-zinc-800/50" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" required placeholder="How can we help?" className="bg-zinc-50 dark:bg-zinc-800/50" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea 
                id="message" 
                name="message"
                required 
                placeholder="Write your message here..." 
                className="min-h-[120px] bg-zinc-50 dark:bg-zinc-800/50 resize-none" 
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

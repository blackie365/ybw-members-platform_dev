'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { ConnectionRequestModal } from './ConnectionRequestModal';

export function ConnectButton({ recipientId, recipientName }: { recipientId: string, recipientName: string }) {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't show the connect button if the user is looking at their own profile
  if (user?.uid === recipientId) return null;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Request Connection
      </button>

      {isModalOpen && (
        <ConnectionRequestModal 
          recipientId={recipientId} 
          recipientName={recipientName} 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </>
  );
}
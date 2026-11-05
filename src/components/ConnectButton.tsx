'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { ConnectionRequestModal } from './ConnectionRequestModal';

/**
 * The one action a member profile offers. Styled as the register's filled
 * control rather than a rounded coloured pill, so it reads as part of the
 * directory rather than a widget dropped into it.
 */
export function ConnectButton({ recipientId, recipientName }: { recipientId: string; recipientName: string }) {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't show the connect button if the user is looking at their own profile
  if (user?.uid === recipientId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 bg-accent px-5 text-[11px] font-medium uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MessageSquare className="size-4" aria-hidden />
        Request connection
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

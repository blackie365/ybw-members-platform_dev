export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderImage?: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface MessageThread {
  id: string;
  participants: string[]; // Array of user IDs
  participantDetails: {
    [userId: string]: {
      name: string;
      image?: string;
      slug?: string;
    };
  };
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: {
    [userId: string]: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterImage?: string;
  requesterSlug?: string;
  targetId: string;
  targetName: string;
  targetImage?: string;
  targetSlug?: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper to format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Get other participant from thread
export function getOtherParticipant(thread: MessageThread, currentUserId: string) {
  const otherId = thread.participants.find(id => id !== currentUserId);
  if (!otherId) return null;
  return {
    id: otherId,
    ...thread.participantDetails[otherId],
  };
}

// Generate thread ID from two user IDs (sorted for consistency)
export function generateThreadId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

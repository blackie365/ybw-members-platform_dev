export type EventType = 'networking' | 'workshop' | 'conference' | 'social' | 'other';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  networking: 'Networking',
  workshop: 'Workshop',
  conference: 'Conference',
  social: 'Social Event',
  other: 'Other',
};

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  image?: string;
  status: 'published' | 'draft' | 'archived';
  eventType: EventType;
  accessLevel?: 'public' | 'members-only';
  price?: number;
  capacity?: number;
  registeredCount?: number;
  externalLink?: string;
  createdAt: string;
  updatedAt?: string;
}

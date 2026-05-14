import { Timestamp } from 'firebase/firestore';

export type EventType = 'networking' | 'workshop' | 'conference' | 'webinar' | 'social' | 'other';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type RSVPStatus = 'confirmed' | 'waitlist' | 'cancelled';

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  coverImage?: string;
  eventType: EventType;
  status: EventStatus;
  
  // Date & Time
  startDate: string; // ISO string
  endDate: string; // ISO string
  timezone: string;
  
  // Location
  isVirtual: boolean;
  location?: string;
  address?: string;
  city?: string;
  virtualLink?: string;
  
  // Capacity & Registration
  capacity?: number;
  registrationCount: number;
  waitlistCount: number;
  registrationDeadline?: string;
  
  // Pricing
  isFree: boolean;
  price?: number;
  currency: string;
  stripeProductId?: string;
  stripePriceId?: string;
  
  // Organizer
  organizerId: string;
  organizerName: string;
  organizerImage?: string;
  
  // Premium-only event
  isPremiumOnly: boolean;
  
  // Tags
  tags?: string[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userImage?: string;
  status: RSVPStatus;
  paidAmount?: number;
  stripePaymentIntentId?: string;
  checkInTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventFormData {
  title: string;
  description: string;
  shortDescription: string;
  coverImage: string;
  eventType: EventType;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  isVirtual: boolean;
  location: string;
  address: string;
  city: string;
  virtualLink: string;
  capacity: string;
  registrationDeadline: string;
  isFree: boolean;
  price: string;
  isPremiumOnly: boolean;
  tags: string;
}

// Event type labels
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  networking: 'Networking',
  workshop: 'Workshop',
  conference: 'Conference',
  webinar: 'Webinar',
  social: 'Social',
  other: 'Other',
};

// Event type colors
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  networking: 'bg-blue-100 text-blue-800',
  workshop: 'bg-purple-100 text-purple-800',
  conference: 'bg-amber-100 text-amber-800',
  webinar: 'bg-green-100 text-green-800',
  social: 'bg-pink-100 text-pink-800',
  other: 'bg-gray-100 text-gray-800',
};

// Helper functions
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatEventDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const isSameDay = start.toDateString() === end.toDateString();
  
  if (isSameDay) {
    return `${formatEventDate(startDate)}, ${formatEventTime(startDate)} - ${formatEventTime(endDate)}`;
  }
  
  return `${formatEventDate(startDate)} - ${formatEventDate(endDate)}`;
}

export function isEventPast(endDate: string): boolean {
  return new Date(endDate) < new Date();
}

export function isEventFull(event: Event): boolean {
  return event.capacity ? event.registrationCount >= event.capacity : false;
}

export function getAvailableSpots(event: Event): number | null {
  if (!event.capacity) return null;
  return Math.max(0, event.capacity - event.registrationCount);
}

export function generateEventSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    + '-' + Date.now().toString(36);
}

export function generateICSFile(event: Event): string {
  const formatICSDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeICS = (text: string): string => {
    return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yorkshire Businesswoman//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(event.endDate)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description.substring(0, 500))}`,
    event.isVirtual && event.virtualLink
      ? `LOCATION:${escapeICS(event.virtualLink)}`
      : event.location
      ? `LOCATION:${escapeICS([event.location, event.address, event.city].filter(Boolean).join(', '))}`
      : '',
    `UID:${event.id}@yorkshirebusinesswoman.co.uk`,
    `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

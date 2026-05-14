import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Event, generateEventSlug } from '@/lib/events';

// GET /api/events - List all published events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'published';
    const upcoming = searchParams.get('upcoming') === 'true';
    const past = searchParams.get('past') === 'true';
    const eventType = searchParams.get('type');

    let query = adminDb.collection('events').where('status', '==', status);

    // Filter by upcoming/past
    const now = new Date().toISOString();
    if (upcoming) {
      query = query.where('startDate', '>=', now);
    } else if (past) {
      query = query.where('endDate', '<', now);
    }

    // Filter by event type
    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }

    // Order by start date
    query = query.orderBy('startDate', upcoming ? 'asc' : 'desc').limit(limit);

    const snapshot = await query.get();
    
    const events: Event[] = [];
    snapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() } as Event);
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/events - Create a new event (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      shortDescription,
      coverImage,
      eventType,
      startDate,
      endDate,
      timezone,
      isVirtual,
      location,
      address,
      city,
      virtualLink,
      capacity,
      registrationDeadline,
      isFree,
      price,
      isPremiumOnly,
      tags,
      organizerId,
      organizerName,
      organizerImage,
    } = body;

    // Validation
    if (!title || !description || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const slug = generateEventSlug(title);
    const now = new Date().toISOString();

    const eventData: Omit<Event, 'id'> = {
      title,
      slug,
      description,
      shortDescription: shortDescription || '',
      coverImage: coverImage || '',
      eventType: eventType || 'other',
      status: 'draft',
      startDate,
      endDate,
      timezone: timezone || 'Europe/London',
      isVirtual: isVirtual || false,
      location: location || '',
      address: address || '',
      city: city || '',
      virtualLink: virtualLink || '',
      capacity: capacity ? parseInt(capacity) : undefined,
      registrationCount: 0,
      waitlistCount: 0,
      registrationDeadline: registrationDeadline || '',
      isFree: isFree !== false,
      price: price ? parseFloat(price) : undefined,
      currency: 'GBP',
      organizerId: organizerId || '',
      organizerName: organizerName || '',
      organizerImage: organizerImage || '',
      isPremiumOnly: isPremiumOnly || false,
      tags: tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('events').add(eventData);

    return NextResponse.json({
      success: true,
      event: { id: docRef.id, ...eventData },
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

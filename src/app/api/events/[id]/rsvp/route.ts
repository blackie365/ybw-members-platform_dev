import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Event, EventRegistration, RSVPStatus } from '@/lib/events';
import { FieldValue } from 'firebase-admin/firestore';

// GET /api/events/[id]/rsvp - Get registrations for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // If userId is provided, check if this user is registered
    if (userId) {
      const snapshot = await adminDb
        .collection('eventRegistrations')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return NextResponse.json({ registration: null });
      }

      const doc = snapshot.docs[0];
      return NextResponse.json({
        registration: { id: doc.id, ...doc.data() } as EventRegistration,
      });
    }

    // Otherwise, return all registrations
    const snapshot = await adminDb
      .collection('eventRegistrations')
      .where('eventId', '==', eventId)
      .orderBy('createdAt', 'asc')
      .get();

    const registrations: EventRegistration[] = [];
    snapshot.forEach((doc) => {
      registrations.push({ id: doc.id, ...doc.data() } as EventRegistration);
    });

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}

// POST /api/events/[id]/rsvp - Register for an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { userId, userEmail, userName, userImage } = body;

    if (!userId || !userEmail || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as Event;

    // Check if registration deadline has passed
    if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) {
      return NextResponse.json(
        { error: 'Registration deadline has passed' },
        { status: 400 }
      );
    }

    // Check if event has already started
    if (new Date(event.startDate) < new Date()) {
      return NextResponse.json(
        { error: 'This event has already started' },
        { status: 400 }
      );
    }

    // Check if user is already registered
    const existingReg = await adminDb
      .collection('eventRegistrations')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingReg.empty) {
      const existing = existingReg.docs[0];
      return NextResponse.json({
        success: true,
        registration: { id: existing.id, ...existing.data() },
        message: 'You are already registered for this event',
      });
    }

    // Determine registration status
    let status: RSVPStatus = 'confirmed';
    if (event.capacity && event.registrationCount >= event.capacity) {
      status = 'waitlist';
    }

    const now = new Date().toISOString();
    const registrationData: Omit<EventRegistration, 'id'> = {
      eventId,
      userId,
      userEmail,
      userName,
      userImage: userImage || '',
      status,
      createdAt: now,
      updatedAt: now,
    };

    // Create registration
    const regRef = await adminDb.collection('eventRegistrations').add(registrationData);

    // Update event counts
    if (status === 'confirmed') {
      await adminDb.collection('events').doc(eventId).update({
        registrationCount: FieldValue.increment(1),
        updatedAt: now,
      });
    } else {
      await adminDb.collection('events').doc(eventId).update({
        waitlistCount: FieldValue.increment(1),
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      registration: { id: regRef.id, ...registrationData },
      message: status === 'confirmed'
        ? 'You have been registered for this event!'
        : 'The event is full. You have been added to the waitlist.',
    });
  } catch (error) {
    console.error('Error creating registration:', error);
    return NextResponse.json(
      { error: 'Failed to register for event' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]/rsvp - Cancel registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find the registration
    const snapshot = await adminDb
      .collection('eventRegistrations')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const regDoc = snapshot.docs[0];
    const registration = regDoc.data() as EventRegistration;

    // Delete the registration
    await adminDb.collection('eventRegistrations').doc(regDoc.id).delete();

    // Update event counts
    const now = new Date().toISOString();
    if (registration.status === 'confirmed') {
      await adminDb.collection('events').doc(eventId).update({
        registrationCount: FieldValue.increment(-1),
        updatedAt: now,
      });

      // If there's a waitlist, promote the first person
      const waitlistSnapshot = await adminDb
        .collection('eventRegistrations')
        .where('eventId', '==', eventId)
        .where('status', '==', 'waitlist')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      if (!waitlistSnapshot.empty) {
        const nextInLine = waitlistSnapshot.docs[0];
        await adminDb.collection('eventRegistrations').doc(nextInLine.id).update({
          status: 'confirmed',
          updatedAt: now,
        });
        await adminDb.collection('events').doc(eventId).update({
          registrationCount: FieldValue.increment(1),
          waitlistCount: FieldValue.increment(-1),
        });

        // TODO: Send email notification to the promoted user
      }
    } else if (registration.status === 'waitlist') {
      await adminDb.collection('events').doc(eventId).update({
        waitlistCount: FieldValue.increment(-1),
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Registration cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling registration:', error);
    return NextResponse.json(
      { error: 'Failed to cancel registration' },
      { status: 500 }
    );
  }
}

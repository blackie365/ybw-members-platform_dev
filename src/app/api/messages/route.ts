import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { MessageThread, generateThreadId } from '@/lib/messages';

// GET /api/messages - Get all message threads for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection('messageThreads')
      .where('participants', 'array-contains', userId)
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();

    const threads: MessageThread[] = [];
    snapshot.forEach((doc) => {
      threads.push({ id: doc.id, ...doc.data() } as MessageThread);
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error('Error fetching message threads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/messages - Create a new message thread or get existing one
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, senderName, senderImage, senderSlug, recipientId, recipientName, recipientImage, recipientSlug, message } = body;

    if (!senderId || !recipientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const threadId = generateThreadId(senderId, recipientId);
    const now = new Date().toISOString();

    // Check if thread already exists
    const existingThread = await adminDb.collection('messageThreads').doc(threadId).get();

    let thread: MessageThread;

    if (existingThread.exists) {
      thread = { id: existingThread.id, ...existingThread.data() } as MessageThread;
    } else {
      // Create new thread
      const threadData: Omit<MessageThread, 'id'> = {
        participants: [senderId, recipientId],
        participantDetails: {
          [senderId]: {
            name: senderName || 'Unknown',
            image: senderImage || '',
            slug: senderSlug || '',
          },
          [recipientId]: {
            name: recipientName || 'Unknown',
            image: recipientImage || '',
            slug: recipientSlug || '',
          },
        },
        unreadCount: {
          [senderId]: 0,
          [recipientId]: 0,
        },
        createdAt: now,
        updatedAt: now,
      };

      await adminDb.collection('messageThreads').doc(threadId).set(threadData);
      thread = { id: threadId, ...threadData };
    }

    // If a message was provided, add it to the thread
    if (message && message.trim()) {
      const messageData = {
        threadId,
        senderId,
        senderName: senderName || 'Unknown',
        senderImage: senderImage || '',
        content: message.trim(),
        read: false,
        createdAt: now,
      };

      await adminDb.collection('messages').add(messageData);

      // Update thread with last message
      await adminDb.collection('messageThreads').doc(threadId).update({
        lastMessage: {
          content: message.trim().substring(0, 100),
          senderId,
          createdAt: now,
        },
        [`unreadCount.${recipientId}`]: (thread.unreadCount?.[recipientId] || 0) + 1,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true, thread });
  } catch (error) {
    console.error('Error creating message thread:', error);
    return NextResponse.json(
      { error: 'Failed to create message thread' },
      { status: 500 }
    );
  }
}

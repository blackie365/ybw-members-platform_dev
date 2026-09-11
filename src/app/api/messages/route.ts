import { NextRequest, NextResponse } from 'next/server';
import { MessageThread, generateThreadId } from '@/lib/messages';
import {
  getPgMessageStore,
  getPgMessageThreadStore,
} from '@/features/messaging/server/pg-messages-store';

// GET /api/messages - Get all message threads for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const threads: MessageThread[] = await getPgMessageThreadStore().listForUser(userId, 50);

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

    const threadStore = getPgMessageThreadStore();
    const existing = await threadStore.get(threadId);

    let thread: MessageThread;
    if (existing) {
      thread = existing;
    } else {
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
      thread = await threadStore.upsert(threadId, threadData, {
        merge: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // If a message was provided, add it to the thread
    if (message && message.trim()) {
      const messageStore = getPgMessageStore();
      await messageStore.create({
        threadId,
        senderId,
        senderName: senderName || 'Unknown',
        senderImage: senderImage || '',
        content: message.trim(),
        read: false,
        createdAt: now,
      });

      // Update thread with last message
      const nextUnreadRecipient = (thread.unreadCount?.[recipientId] || 0) + 1;
      await threadStore.updateNestedFields(threadId, {
        'lastMessage.content': message.trim().substring(0, 100),
        'lastMessage.senderId': senderId,
        'lastMessage.createdAt': now,
        [`unreadCount.${recipientId}`]: nextUnreadRecipient,
      });

      const refreshed = await threadStore.get(threadId);
      if (refreshed) thread = refreshed;
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

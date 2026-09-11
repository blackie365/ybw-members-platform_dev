import { NextRequest, NextResponse } from 'next/server';
import { Message, MessageThread } from '@/lib/messages';
import {
  getPgMessageStore,
  getPgMessageThreadStore,
} from '@/features/messaging/server/pg-messages-store';

// GET /api/messages/[threadId] - Get messages in a thread
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get the thread first
    const threadStore = getPgMessageThreadStore();
    const messageStore = getPgMessageStore();
    const thread: MessageThread | null = await threadStore.get(threadId);

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Verify user is a participant
    if (userId && !thread.participants.includes(userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get messages (ASC order already from listForThread)
    const messages: Message[] = await messageStore.listForThread(threadId, limit);

    // Mark messages as read for the current user
    if (userId) {
      const toMarkRead = messages
        .filter((m) => m.senderId !== userId && !m.read)
        .map((m) => m.id);
      if (toMarkRead.length > 0) {
        await messageStore.markRead(toMarkRead);
        await threadStore.updateNestedFields(threadId, {
          [`unreadCount.${userId}`]: 0,
        });
        // Reload messages so they carry the new read=true flag
        for (const mid of toMarkRead) {
          const match = messages.find((m) => m.id === mid);
          if (match) match.read = true;
        }
      }
    }

    return NextResponse.json({
      thread,
      messages,
    });
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/messages/[threadId] - Send a message in a thread
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params;
    const body = await request.json();
    const { senderId, senderName, senderImage, content } = body;

    if (!senderId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const threadStore = getPgMessageThreadStore();
    const messageStore = getPgMessageStore();

    // Verify thread exists and user is a participant
    const thread: MessageThread | null = await threadStore.get(threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (!thread.participants.includes(senderId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const recipientId = thread.participants.find((id) => id !== senderId);

    // Create message
    const messageData = {
      threadId,
      senderId,
      senderName: senderName || 'Unknown',
      senderImage: senderImage || '',
      content: content.trim(),
      read: false,
      createdAt: now,
    };

    const created = await messageStore.create(messageData);

    // Update thread
    const nextUnread = recipientId
      ? (thread.unreadCount?.[recipientId] || 0) + 1
      : 0;
    const nestedUpdates: Record<string, unknown> = {
      'lastMessage.content': content.trim().substring(0, 100),
      'lastMessage.senderId': senderId,
      'lastMessage.createdAt': now,
    };
    if (recipientId) nestedUpdates[`unreadCount.${recipientId}`] = nextUnread;
    await threadStore.updateNestedFields(threadId, nestedUpdates);

    return NextResponse.json({
      success: true,
      message: created,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

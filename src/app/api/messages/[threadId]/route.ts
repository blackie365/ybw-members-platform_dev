import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Message, MessageThread } from '@/lib/messages';

// GET /api/messages/[threadId] - Get messages in a thread
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get the thread first
    const threadDoc = await adminDb.collection('messageThreads').doc(threadId).get();
    
    if (!threadDoc.exists) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const thread = { id: threadDoc.id, ...threadDoc.data() } as MessageThread;

    // Verify user is a participant
    if (userId && !thread.participants.includes(userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get messages
    const snapshot = await adminDb
      .collection('messages')
      .where('threadId', '==', threadId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const messages: Message[] = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as Message);
    });

    // Mark messages as read for the current user
    if (userId) {
      const batch = adminDb.batch();
      let unreadCount = 0;

      for (const message of messages) {
        if (message.senderId !== userId && !message.read) {
          const msgRef = adminDb.collection('messages').doc(message.id);
          batch.update(msgRef, { read: true });
          unreadCount++;
        }
      }

      if (unreadCount > 0) {
        // Update unread count
        await adminDb.collection('messageThreads').doc(threadId).update({
          [`unreadCount.${userId}`]: 0,
        });
        await batch.commit();
      }
    }

    return NextResponse.json({
      thread,
      messages: messages.reverse(), // Return in chronological order
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
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const body = await request.json();
    const { senderId, senderName, senderImage, content } = body;

    if (!senderId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify thread exists and user is a participant
    const threadDoc = await adminDb.collection('messageThreads').doc(threadId).get();
    
    if (!threadDoc.exists) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const thread = threadDoc.data() as Omit<MessageThread, 'id'>;

    if (!thread.participants.includes(senderId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const recipientId = thread.participants.find(id => id !== senderId);

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

    const msgRef = await adminDb.collection('messages').add(messageData);

    // Update thread
    await adminDb.collection('messageThreads').doc(threadId).update({
      lastMessage: {
        content: content.trim().substring(0, 100),
        senderId,
        createdAt: now,
      },
      [`unreadCount.${recipientId}`]: (thread.unreadCount?.[recipientId!] || 0) + 1,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      message: { id: msgRef.id, ...messageData },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

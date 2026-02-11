/**
 * Chat Management Utilities
 *
 * Functions for creating and managing chats between customers and carriers.
 */

import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Chat {
  id: string;
  request_id: string;
  participants: string[];
  customer_id: string;
  carrier_id: string;
  last_message: string;
  last_message_time: any;
  unread_count: {
    [userId: string]: number;
  };
  created_at: any;
  updated_at?: any;
}

/**
 * Create a chat between customer and carrier when bid is accepted
 *
 * @param requestId - The cargo request ID
 * @param customerId - The customer's user ID
 * @param carrierId - The carrier's user ID
 * @returns The created chat ID
 *
 * @example
 * const chatId = await createChat(requestId, customerId, carrierId);
 * router.push(`/chat/${requestId}/${carrierId}`);
 */
export async function createChat(
  requestId: string,
  customerId: string,
  carrierId: string
): Promise<string> {
  try {
    // Generate deterministic chat ID
    const chatId = `${requestId}_${customerId}_${carrierId}`;

    console.log('Creating chat:', { chatId, requestId, customerId, carrierId });

    // Check if chat already exists
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      console.log('Chat already exists:', chatId);
      return chatId;
    }

    // Create new chat
    const chatData: Chat = {
      id: chatId,
      request_id: requestId,
      participants: [customerId, carrierId],
      customer_id: customerId,
      carrier_id: carrierId,
      last_message: '',
      last_message_time: serverTimestamp(),
      unread_count: {
        [customerId]: 0,
        [carrierId]: 0,
      },
      created_at: serverTimestamp(),
    };

    await setDoc(chatRef, chatData);

    console.log('✅ Chat created successfully:', chatId);
    return chatId;
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    throw error;
  }
}

/**
 * Get or create chat (idempotent)
 *
 * This function ensures a chat exists, creating it if necessary.
 * Safe to call multiple times with the same parameters.
 *
 * @param requestId - The cargo request ID
 * @param customerId - The customer's user ID
 * @param carrierId - The carrier's user ID
 * @returns The chat ID
 */
export async function getOrCreateChat(
  requestId: string,
  customerId: string,
  carrierId: string
): Promise<string> {
  const chatId = `${requestId}_${customerId}_${carrierId}`;

  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      return chatId;
    }

    // Chat doesn't exist, create it
    return await createChat(requestId, customerId, carrierId);
  } catch (error) {
    console.error('Error in getOrCreateChat:', error);
    throw error;
  }
}

/**
 * Update chat's last message info
 *
 * Called after sending a message to update the chat metadata.
 *
 * @param chatId - The chat ID
 * @param lastMessage - The last message text
 * @param senderId - The sender's user ID
 */
export async function updateChatLastMessage(
  chatId: string,
  lastMessage: string,
  senderId: string
): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      console.error('Chat not found:', chatId);
      return;
    }

    const chatData = chatSnap.data() as Chat;
    const otherParticipant = chatData.participants.find(p => p !== senderId);

    if (!otherParticipant) {
      console.error('Could not find other participant');
      return;
    }

    // Increment unread count for the receiver
    const updatedUnreadCount = {
      ...chatData.unread_count,
      [otherParticipant]: (chatData.unread_count[otherParticipant] || 0) + 1,
    };

    await updateDoc(chatRef, {
      last_message: lastMessage.substring(0, 100), // Limit to 100 chars
      last_message_time: serverTimestamp(),
      unread_count: updatedUnreadCount,
      updated_at: serverTimestamp(),
    });

    console.log('✅ Chat updated with last message');
  } catch (error) {
    console.error('❌ Error updating chat last message:', error);
    throw error;
  }
}

/**
 * Mark chat as read for a user
 *
 * Called when user opens the chat to reset their unread count.
 *
 * @param chatId - The chat ID
 * @param userId - The user ID who is reading the chat
 */
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      console.error('Chat not found:', chatId);
      return;
    }

    const chatData = chatSnap.data() as Chat;

    // Reset unread count for this user
    const updatedUnreadCount = {
      ...chatData.unread_count,
      [userId]: 0,
    };

    await updateDoc(chatRef, {
      unread_count: updatedUnreadCount,
      updated_at: serverTimestamp(),
    });

    console.log('✅ Chat marked as read for user:', userId);
  } catch (error) {
    console.error('❌ Error marking chat as read:', error);
    throw error;
  }
}

/**
 * Get chat by ID
 *
 * @param chatId - The chat ID
 * @returns Chat data or null if not found
 */
export async function getChat(chatId: string): Promise<Chat | null> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      return null;
    }

    return chatSnap.data() as Chat;
  } catch (error) {
    console.error('Error getting chat:', error);
    return null;
  }
}

/**
 * Check if chat exists for a request
 *
 * @param requestId - The cargo request ID
 * @param customerId - The customer's user ID
 * @param carrierId - The carrier's user ID
 * @returns True if chat exists
 */
export async function chatExists(
  requestId: string,
  customerId: string,
  carrierId: string
): Promise<boolean> {
  try {
    const chatId = `${requestId}_${customerId}_${carrierId}`;
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    return chatSnap.exists();
  } catch (error) {
    console.error('Error checking if chat exists:', error);
    return false;
  }
}

/**
 * Generate chat ID from request and user IDs
 *
 * @param requestId - The cargo request ID
 * @param customerId - The customer's user ID
 * @param carrierId - The carrier's user ID
 * @returns The chat ID
 */
export function generateChatId(requestId: string, customerId: string, carrierId: string): string {
  return `${requestId}_${customerId}_${carrierId}`;
}

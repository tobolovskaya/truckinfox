import { supabase } from '../lib/supabase';

export interface Chat {
  id: string;
  request_id: string;
  participants: string[];
  customer_id: string;
  carrier_id: string;
  last_message: string;
  last_message_time: string | null;
  unread_count: {
    [userId: string]: number;
  };
  created_at: string | null;
  updated_at?: string | null;
}

export async function createChat(
  requestId: string,
  customerId: string,
  carrierId: string
): Promise<string> {
  try {
    const chatId = generateChatId(requestId, customerId, carrierId);
    const sortedUsers = [customerId, carrierId].sort();

    const { error } = await supabase.from('chats').upsert(
      {
        id: chatId,
        request_id: requestId,
        user_a_id: sortedUsers[0],
        user_b_id: sortedUsers[1],
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_a: 0,
        unread_b: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      throw error;
    }

    return chatId;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
}

export async function getOrCreateChat(
  requestId: string,
  customerId: string,
  carrierId: string
): Promise<string> {
  const chatId = generateChatId(requestId, customerId, carrierId);

  try {
    const { data } = await supabase.from('chats').select('id').eq('id', chatId).maybeSingle();
    if (data?.id) {
      return chatId;
    }

    return await createChat(requestId, customerId, carrierId);
  } catch (error) {
    console.error('Error in getOrCreateChat:', error);
    throw error;
  }
}

export async function updateChatLastMessage(
  chatId: string,
  lastMessage: string,
  senderId: string
): Promise<void> {
  try {
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('user_a_id,user_b_id,unread_a,unread_b')
      .eq('id', chatId)
      .maybeSingle();

    if (chatError || !chat) {
      return;
    }

    const unreadA = Number(chat.unread_a || 0);
    const unreadB = Number(chat.unread_b || 0);

    const nextUnreadA = senderId === chat.user_b_id ? unreadA + 1 : unreadA;
    const nextUnreadB = senderId === chat.user_a_id ? unreadB + 1 : unreadB;

    const { error } = await supabase
      .from('chats')
      .update({
        last_message: lastMessage.substring(0, 100),
        last_message_at: new Date().toISOString(),
        unread_a: nextUnreadA,
        unread_b: nextUnreadB,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating chat last message:', error);
    throw error;
  }
}

export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  try {
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('user_a_id,user_b_id')
      .eq('id', chatId)
      .maybeSingle();

    if (chatError || !chat) {
      return;
    }

    const updatePayload: { unread_a?: number; unread_b?: number; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (userId === chat.user_a_id) {
      updatePayload.unread_a = 0;
    } else if (userId === chat.user_b_id) {
      updatePayload.unread_b = 0;
    }

    const { error } = await supabase.from('chats').update(updatePayload).eq('id', chatId);
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error marking chat as read:', error);
    throw error;
  }
}

export async function getChat(chatId: string): Promise<Chat | null> {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select(
        'id, request_id, user_a_id, user_b_id, last_message, last_message_at, unread_a, unread_b, created_at, updated_at'
      )
      .eq('id', chatId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      request_id: data.request_id ?? '',
      participants: [data.user_a_id, data.user_b_id],
      customer_id: data.user_a_id,
      carrier_id: data.user_b_id,
      last_message: data.last_message || '',
      last_message_time: data.last_message_at || null,
      unread_count: {
        [data.user_a_id]: Number(data.unread_a || 0),
        [data.user_b_id]: Number(data.unread_b || 0),
      },
      created_at: data.created_at || null,
      updated_at: data.updated_at || null,
    };
  } catch (error) {
    console.error('Error getting chat:', error);
    return null;
  }
}

export async function chatExists(
  requestId: string,
  customerId: string,
  carrierId: string
): Promise<boolean> {
  try {
    const chatId = generateChatId(requestId, customerId, carrierId);
    const { data, error } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .maybeSingle();
    return !error && Boolean(data?.id);
  } catch (error) {
    console.error('Error checking if chat exists:', error);
    return false;
  }
}

export function generateChatId(requestId: string, userId1: string, userId2: string): string {
  const sortedUsers = [userId1, userId2].sort();
  return `${requestId}_${sortedUsers[0]}_${sortedUsers[1]}`;
}

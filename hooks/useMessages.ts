import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ChatMessage {
  id: string;
  chat_id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  sender_type: 'customer' | 'carrier';
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface Conversation {
  id: string;
  request_id: string;
  user_a_id: string;
  user_b_id: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_a: number;
  unread_b: number;
  updated_at: string;
  other_user?: {
    id: string;
    full_name: string;
    user_type: string;
    rating: number;
  };
}

/** Hook: messages for a conversation with realtime subscription */
export function useConversation(chatId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMessages = useCallback(async () => {
    if (!chatId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('id, chat_id, content, sender_id, receiver_id, sender_type, created_at, delivered_at, read_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(new Error(fetchError.message));
    } else {
      setMessages((data || []) as ChatMessage[]);
    }
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    loadMessages();

    if (!chatId) return;

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        () => { loadMessages(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [chatId, loadMessages]);

  return { messages, loading, error, refetch: loadMessages };
}

/** Send a message in a conversation */
export async function sendMessage(
  chatId: string,
  requestId: string,
  senderId: string,
  receiverId: string,
  content: string,
  senderType: 'customer' | 'carrier'
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    request_id: requestId,
    content,
    sender_id: senderId,
    receiver_id: receiverId,
    sender_type: senderType,
    created_at: now,
    delivered_at: now,
  });

  return { error: error ? new Error(error.message) : null };
}

/** Mark all messages in a chat as read for a receiver */
export async function markAsRead(chatId: string, receiverId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('receiver_id', receiverId)
    .is('read_at', null);

  return { error: error ? new Error(error.message) : null };
}

/** Hook: all conversations for the current user with unread counts */
export function useConversationList() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('chats')
      .select('*')
      .or(`user_a_id.eq.${user.uid},user_b_id.eq.${user.uid}`)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError(new Error(fetchError.message));
      setLoading(false);
      return;
    }

    // Fetch other user profiles
    const chats = (data || []) as Conversation[];
    const otherUserIds = chats.map(c =>
      c.user_a_id === user.uid ? c.user_b_id : c.user_a_id
    );
    const uniqueIds = [...new Set(otherUserIds)];

    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, rating')
        .in('id', uniqueIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched = chats.map(c => ({
        ...c,
        other_user: profileMap.get(c.user_a_id === user.uid ? c.user_b_id : c.user_a_id) as Conversation['other_user'],
      }));
      setConversations(enriched);
    } else {
      setConversations(chats);
    }
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    loadConversations();

    if (!user?.uid) return;

    const channel = supabase
      .channel(`chats:${user.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => { loadConversations(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user?.uid, loadConversations]);

  return { conversations, loading, error, refetch: loadConversations };
}

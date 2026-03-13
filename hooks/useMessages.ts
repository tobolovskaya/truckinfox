import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, chat_id, content, sender_id, receiver_id, sender_type, created_at, delivered_at, read_at')
        .eq('chat_id', chatId!)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as ChatMessage[];
    },
    enabled: Boolean(chatId),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['messages', chatId] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [chatId, queryClient]);

  return {
    messages: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
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
  const uid = user?.uid;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);

      const chats = (data || []) as Conversation[];
      const otherUserIds = chats.map(c =>
        c.user_a_id === uid ? c.user_b_id : c.user_a_id
      );
      const uniqueIds = [...new Set(otherUserIds)];

      if (uniqueIds.length === 0) return chats;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, rating')
        .in('id', uniqueIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return chats.map(c => ({
        ...c,
        other_user: profileMap.get(
          c.user_a_id === uid ? c.user_b_id : c.user_a_id
        ) as Conversation['other_user'],
      }));
    },
    enabled: Boolean(uid),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`chats:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => { queryClient.invalidateQueries({ queryKey: ['conversations', uid] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [uid, queryClient]);

  return {
    conversations: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

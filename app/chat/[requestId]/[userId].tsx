import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { sanitizeMessage } from '../../../utils/sanitization';
import { trackTypingDetected, trackChatOpened, trackMessageSent } from '../../../utils/analytics';
import { startTrace, PerformanceTraces } from '../../../utils/performance';
import { supabase } from '../../../lib/supabase';

import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { generateChatId } from '../../../utils/chatManagement';
import { theme } from '../../../theme/theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import {
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
  useAppThemeStyles,
} from '../../../lib/sharedStyles';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  delivered_at?: unknown;
  read_at?: unknown;
  sender: {
    full_name: string;
    user_type: string;
  };
}

type MessageRow = {
  id: string;
  content: string | null;
  sender_id: string;
  receiver_id: string | null;
  created_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
};

interface ChatUser {
  id: string;
  full_name: string;
  user_type: string;
  rating: number;
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const requestId = typeof params.requestId === 'string' ? params.requestId : undefined;
  const userId = typeof params.userId === 'string' ? params.userId : undefined;
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messageAnimations = useRef<{ [key: string]: Animated.Value }>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingTraceRef = useRef<ReturnType<typeof startTrace> | null>(null);
  const lastTypingStartRef = useRef<number>(0);

  useEffect(() => {
    if (!requestId || !userId || !user?.uid) {
      console.log('Missing required parameters for chat');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        await fetchChatData();
        const unsubscribe = await fetchMessages();
        return unsubscribe;
      } catch (error) {
        console.error('Error loading chat data:', error);
        setLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;

    loadData().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // Clear all message animations when chat changes
      messageAnimations.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, userId]);

  // Typing indicator listener
  useEffect(() => {
    if (!requestId || !userId || !user?.uid) return;

    const channel = supabase
      .channel(`typing:${requestId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `request_id=eq.${requestId}`,
        },
        payload => {
          const row = (payload.new || payload.old) as
            | { user_id?: string; typing?: boolean; timestamp?: string }
            | undefined;

          if (!row || row.user_id !== userId) {
            return;
          }

          const now = Date.now();
          const lastTyping = row.timestamp ? new Date(row.timestamp).getTime() : 0;
          const isTyping = Boolean(row.typing) && now - lastTyping < 3000;

          if (isTyping && !otherUserTyping) {
            typingTraceRef.current = startTrace(PerformanceTraces.TYPING_INDICATOR_LATENCY);
            lastTypingStartRef.current = now;
            trackTypingDetected({
              chat_id: requestId,
            });
          } else if (!isTyping && otherUserTyping && typingTraceRef.current) {
            typingTraceRef.current.stop();
            typingTraceRef.current = null;

            const responseTime = Date.now() - lastTypingStartRef.current;
            if (responseTime > 0) {
              trackTypingDetected({
                chat_id: requestId,
                response_time: responseTime,
              });
            }
          }

          setOtherUserTyping(isTyping);
        }
      )
      .subscribe();

    const timeoutId = setInterval(async () => {
      const { data } = await supabase
        .from('typing_indicators')
        .select('typing,timestamp')
        .eq('request_id', requestId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) {
        setOtherUserTyping(false);
        return;
      }

      const now = Date.now();
      const lastTyping = data.timestamp ? new Date(data.timestamp).getTime() : 0;
      setOtherUserTyping(Boolean(data.typing) && now - lastTyping < 3000);
    }, 3000);

    return () => {
      clearInterval(timeoutId);
      channel.unsubscribe();
      if (typingTraceRef.current) {
        typingTraceRef.current.stop();
      }
    };
  }, [requestId, userId, user?.uid, otherUserTyping]);

  const fetchChatData = async () => {
    try {
      if (!userId) {
        console.log('Missing userId for fetchChatData');
        return;
      }

      const { data: userData, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, rating')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      if (userData) {
        setChatUser({
          id: userData.id,
          full_name: userData.full_name || 'Unknown User',
          user_type: userData.user_type || 'customer',
          rating: userData.rating || 0,
        });

        // Track chat opened
        if (requestId && user?.uid) {
          const chatId = generateChatId(requestId, user.uid, userId);
          trackChatOpened({
            request_id: requestId,
            other_user_type: userData.user_type || 'customer',
            chat_id: chatId,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching chat data:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      if (!user?.uid || !userId || !requestId) {
        console.log('Missing required IDs for fetching messages');
        setLoading(false);
        return;
      }

      const chatId = generateChatId(requestId, user.uid, userId);

      const loadMessages = async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('id, content, sender_id, receiver_id, created_at, delivered_at, read_at')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        const fetchedMessages = ((data || []) as MessageRow[]).map(message => ({
          id: message.id,
          content: message.content || '',
          sender_id: message.sender_id,
          receiver_id: message.receiver_id || '',
          created_at: message.created_at || new Date().toISOString(),
          delivered_at: message.delivered_at,
          read_at: message.read_at,
          sender: {
            full_name: message.sender_id === user.uid ? user.displayName || 'You' : chatUser?.full_name || 'Unknown',
            user_type: message.sender_id === user.uid ? 'customer' : chatUser?.user_type || 'customer',
          },
        }));

        setMessages(fetchedMessages);
        setLoading(false);
      };

      await loadMessages();

      const channel = supabase
        .channel(`messages:${chatId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `chat_id=eq.${chatId}`,
          },
          async () => {
            await loadMessages();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up messages listener:', error);
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    if (!user?.uid || !userId || !requestId) {
      Alert.alert(t('error'), 'Missing required information to send message');
      return;
    }

    // 🔐 Sanitize message before sending
    const sanitizedMessage = sanitizeMessage(newMessage.trim(), 1000);

    if (!sanitizedMessage) {
      Alert.alert(t('error'), t('messageCannotBeEmpty'));
      return;
    }

    setSending(true);
    try {
      // Create deterministic chat ID (sorted user IDs)
      const chatId = generateChatId(requestId, user.uid, userId);

      const { error } = await supabase.from('messages').insert({
        chat_id: chatId,
        request_id: requestId,
        content: sanitizedMessage,
        sender_id: user.uid,
        receiver_id: userId,
        sender_type: 'customer',
        created_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      // Track message sent
      trackMessageSent({
        chat_id: chatId,
        message_length: sanitizedMessage.length,
        has_attachment: false,
        request_id: requestId,
      });

      setNewMessage('');
      // Messages will be updated via real-time listener
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert(t('error'), error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!user?.uid || !userId || !requestId) return;

    try {
      const chatId = generateChatId(requestId, user.uid, userId);
      const { error } = await supabase
        .from('messages')
        .update({
          read_at: new Date().toISOString(),
        })
        .eq('chat_id', chatId)
        .eq('receiver_id', user.uid)
        .is('read_at', null);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [requestId, user?.uid, userId]);

  // Mark messages as read when screen is focused
  useEffect(() => {
    if (messages.length > 0) {
      markMessagesAsRead();
    }
  }, [messages.length, markMessagesAsRead]);

  // Get read receipt icon
  const getReadReceiptIcon = (message: Message) => {
    if (message.sender_id !== user?.uid) return null; // Only show for sent messages

    if (message.read_at) {
      return <Ionicons name="checkmark-done" size={14} color="white" style={styles.readIcon} />;
    } else if (message.delivered_at) {
      return (
        <Ionicons
          name="checkmark-done"
          size={14}
          color="rgba(255,255,255,0.6)"
          style={styles.readIcon}
        />
      );
    } else {
      return (
        <Ionicons
          name="checkmark"
          size={14}
          color="rgba(255,255,255,0.6)"
          style={styles.readIcon}
        />
      );
    }
  };

  // Update typing status
  const handleTypingChange = async (text: string) => {
    setNewMessage(text);

    if (!user?.uid || !requestId || !userId) return;

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update typing indicator
    if (text.length > 0) {
      await supabase.from('typing_indicators').upsert(
        {
          request_id: requestId,
          user_id: user.uid,
          typing: true,
          timestamp: new Date().toISOString(),
        },
        { onConflict: 'request_id,user_id' }
      );

      // Clear typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(async () => {
        await supabase.from('typing_indicators').upsert(
          {
            request_id: requestId,
            user_id: user.uid,
            typing: false,
            timestamp: new Date().toISOString(),
          },
          { onConflict: 'request_id,user_id' }
        );
      }, 3000);
    }
  };

  type TimestampLike = Date | string | number | { toDate?: () => Date } | null | undefined;

  const convertToDate = (timestamp: TimestampLike): Date => {
    if (!timestamp) return new Date();
    // Handle Firestore Timestamp object
    if (
      typeof timestamp === 'object' &&
      'toDate' in timestamp &&
      typeof timestamp.toDate === 'function'
    ) {
      return timestamp.toDate();
    }
    // Handle Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (typeof timestamp !== 'string' && typeof timestamp !== 'number') {
      return new Date();
    }
    // Handle string
    return new Date(timestamp);
  };

  const formatTime = (timestamp: TimestampLike) => {
    const date = convertToDate(timestamp);
    if (isNaN(date.getTime())) {
      return '--:--';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: TimestampLike) => {
    const date = convertToDate(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('today');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('yesterday');
    } else {
      return date.toLocaleDateString();
    }
  };

  const getUserInitials = (fullName: string) => {
    if (!fullName) return 'U';
    return fullName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRoleText = (userType: string, rating: number) => {
    const roleMap: { [key: string]: string } = {
      business: 'Bedrift',
      customer: 'Kunde',
      carrier: 'Sjåfør',
    };
    const role = roleMap[userType] || 'Bruker';
    const ratingText = typeof rating === 'number' ? rating.toFixed(1) : '0.0';
    return `${role} • ⭐ ${ratingText}`;
  };

  const animateMessage = (messageId: string) => {
    if (!messageAnimations.current[messageId]) {
      messageAnimations.current[messageId] = new Animated.Value(0);
    }

    Animated.sequence([
      Animated.timing(messageAnimations.current[messageId], {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    console.log('Messages updated:', messages.length);

    const MAX_ANIMATIONS = 100; // Limit to prevent memory leaks
    const currentMessageIds = new Set(messages.map(m => m.id));

    // Cleanup animations for deleted messages
    Object.keys(messageAnimations.current).forEach(id => {
      if (!currentMessageIds.has(id)) {
        delete messageAnimations.current[id];
      }
    });

    // Keep only last MAX_ANIMATIONS
    const animationKeys = Object.keys(messageAnimations.current);
    if (animationKeys.length > MAX_ANIMATIONS) {
      const toDelete = animationKeys.slice(0, animationKeys.length - MAX_ANIMATIONS);
      toDelete.forEach(key => delete messageAnimations.current[key]);
    }

    // Animate new messages
    messages.forEach(message => {
      if (!messageAnimations.current[message.id]) {
        messageAnimations.current[message.id] = new Animated.Value(0);
        animateMessage(message.id);
      }
    });
  }, [messages]);

  const handleAttachmentPress = async () => {
    Alert.alert(t('selectAttachment'), t('attachmentTypePrompt'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('camera'), onPress: openCamera },
      { text: t('gallery'), onPress: openImagePicker },
      { text: t('document'), onPress: openDocumentPicker },
    ]);
  };

  const openCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(t('permissionRequired'), t('cameraPermissionRequired'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleFileSelected(result.assets[0]);
    }
  };

  const openImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleFileSelected(result.assets[0]);
    }
  };

  const openDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        handleFileSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  };

  const handleFileSelected = async (file: { name?: string; size?: number; uri?: string }) => {
    try {
      const fileName = file.name || 'attachment';
      const fileSize = file.size ? `(${Math.round(file.size / 1024)}KB)` : '';

      Alert.alert(t('fileSelected'), `${fileName} ${fileSize}\n\n${t('fileUploadComingSoon')}`);
    } catch (error) {
      console.error('Error handling file:', error);
      Alert.alert(t('error'), t('failedToProcessFile'));
    }
  };

  // Animated typing indicator component
  const TypingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const animateDot = (dot: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: -8,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      animateDot(dot1, 0);
      animateDot(dot2, 200);
      animateDot(dot3, 400);
    }, [dot1, dot2, dot3]);

    return (
      <View style={styles.typingIndicatorContainer}>
        <View style={styles.typingIndicator}>
          <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
          <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
          <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
        </View>
        <Text style={styles.typingText}>
          {chatUser?.full_name || t('user')} {t('isTyping') || 'skriver'}...
        </Text>
      </View>
    );
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
    const date = convertToDate(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title=""
        onBackPress={() => router.back()}
        customCenter={
          <View style={styles.headerInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>
                {getUserInitials(chatUser?.full_name || '')}
              </Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.userName}>{chatUser?.full_name || t('unknownUser')}</Text>
              <Text style={styles.userRole}>
                {chatUser ? getUserRoleText(chatUser.user_type, chatUser.rating) : ''}
              </Text>
            </View>
          </View>
        }
        rightAction={{
          icon: 'information-circle',
          onPress: () => {},
          label: 'Chat info',
        }}
      />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{t('loading')}</Text>
            </View>
          ) : Object.keys(groupedMessages).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={theme.iconColors.gray.primary} />
              <Text style={styles.emptyText}>{t('startConversation')}</Text>
            </View>
          ) : (
            Object.entries(groupedMessages).map(([date, dayMessages]) => (
              <View key={date}>
                <View style={styles.dateSeparator}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateText}>{formatDate(date)}</Text>
                  <View style={styles.dateLine} />
                </View>
                {dayMessages.map(message => (
                  <Animated.View
                    key={message.id}
                    style={[
                      styles.messageContainer,
                      message.sender_id === user?.uid
                        ? styles.sentMessageContainer
                        : styles.receivedMessageContainer,
                      {
                        opacity: messageAnimations.current[message.id] || 1,
                        transform: [
                          {
                            translateY: messageAnimations.current[message.id]
                              ? messageAnimations.current[message.id].interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [20, 0],
                                })
                              : 0,
                          },
                        ],
                      },
                    ]}
                  >
                    {message.sender_id === user?.uid ? (
                      <LinearGradient
                        colors={['#F97316', '#FB923C']}
                        style={[styles.messageBubble, styles.sentMessage]}
                      >
                        <View style={styles.messageContent}>
                          <Text style={[styles.messageText, styles.sentMessageText]}>
                            {message.content}
                          </Text>
                          <View style={styles.messageTimeRow}>
                            <Text style={[styles.messageTime, styles.sentMessageTime]}>
                              {formatTime(message.created_at)}
                            </Text>
                            {getReadReceiptIcon(message)}
                          </View>
                        </View>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.messageBubble, styles.receivedMessage]}>
                        <View style={styles.messageContent}>
                          <Text style={[styles.messageText, styles.receivedMessageText]}>
                            {message.content}
                          </Text>
                          <Text style={[styles.messageTime, styles.receivedMessageTime]}>
                            {formatTime(message.created_at)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </Animated.View>
                ))}
              </View>
            ))
          )}
        </ScrollView>

        {/* Typing Indicator */}
        {otherUserTyping && <TypingIndicator />}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleAttachmentPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Attach file"
          >
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder={t('typeMessage')}
              value={newMessage}
              onChangeText={handleTypingChange}
              multiline
              numberOfLines={1}
              maxLength={500}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={sending ? 'Sending message' : 'Send message'}
          >
            <LinearGradient
              colors={
                newMessage.trim() && !sending ? ['#FF7043', '#FF8A65'] : ['#E5E5EA', '#E5E5EA']
              }
              style={styles.sendButtonGradient}
            >
              <Text
                style={[
                  styles.sendButtonEmoji,
                  (!newMessage.trim() || sending) && styles.sendButtonEmojiDisabled,
                ]}
              >
                {sending ? '⏳' : '➤'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppThemeStyles>['colors']) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarInitials: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  headerText: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.black,
    marginBottom: 1,
  },
  userRole: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  requestCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.md,
  },
  requestCardContent: {
    flexDirection: 'row',
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  requestIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    ...shadows.sm,
  },
  requestIcon: {
    fontSize: fontSize.xl,
  },
  requestDetails: {
    flex: 1,
  },
  requestTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  routeVertical: {
    paddingLeft: 4,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  routeIcon: {
    fontSize: fontSize.sm,
    marginRight: 8,
  },
  routeLocation: {
    fontSize: fontSize.sm,
    color: '#616161',
    fontWeight: '500',
    flex: 1,
  },
  routeArrow: {
    paddingLeft: 4,
    paddingVertical: 2,
  },
  routeArrowText: {
    fontSize: fontSize.sm,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  detailsButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginTop: spacing.sm,
    backgroundColor: '#F97316',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  detailsButtonText: {
    fontSize: fontSize.sm,
    color: 'white',
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: '#616161',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: '#616161',
    marginTop: spacing.sm,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: spacing.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateText: {
    fontSize: fontSize.sm,
    color: '#8E8E93',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginHorizontal: 12,
  },
  messageContainer: {
    marginVertical: 4,
  },
  sentMessageContainer: {
    alignItems: 'flex-end',
  },
  receivedMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 24,
  },
  sentMessage: {
    backgroundColor: 'transparent', // For gradient
    borderBottomRightRadius: 8,
  },
  receivedMessage: {
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 8,
  },
  messageContent: {
    flexDirection: 'column',
  },
  messageText: {
    fontSize: fontSize.md,
    lineHeight: 22,
    marginBottom: spacing.xxxs,
  },
  sentMessageText: {
    color: 'white',
  },
  receivedMessageText: {
    color: '#000000',
  },
  messageTime: {
    fontSize: fontSize.xs,
    alignSelf: 'flex-end',
  },
  sentMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedMessageTime: {
    color: '#616161',
  },
  messageTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
  },
  readIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachIcon: {
    fontSize: fontSize.lg,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: fontSize.md,
    color: '#212121',
    minHeight: 36,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendButton: {
    width: 44, // Minimum 44pt touch target (Apple HIG)
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonEmoji: {
    fontSize: fontSize.md,
  },
  sendButtonEmojiDisabled: {
    opacity: 0.5,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  typingIndicator: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    alignSelf: 'flex-start',
    maxWidth: '75%',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  typingText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  });

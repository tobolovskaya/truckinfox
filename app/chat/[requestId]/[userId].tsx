import React, { useState, useEffect, useRef } from 'react';
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
import { trackTypingDetected } from '../../../utils/analytics';
import { startTrace, PerformanceTraces } from '../../../utils/performance';
import { db } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../../lib/sharedStyles';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  sender: {
    full_name: string;
    user_type: string;
  };
}

interface ChatUser {
  id: string;
  full_name: string;
  user_type: string;
  rating: number;
}

// Typing Indicator Component
const TypingIndicator = () => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -8,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      createAnimation(dot1Anim, 0),
      createAnimation(dot2Anim, 150),
      createAnimation(dot3Anim, 300),
    ]);

    animation.start();

    return () => animation.stop();
  }, [dot1Anim, dot2Anim, dot3Anim]);

  return (
    <View style={styles.typingIndicator}>
      <View style={styles.typingDots}>
        <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1Anim }] }]} />
        <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2Anim }] }]} />
        <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3Anim }] }]} />
      </View>
    </View>
  );
};

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const requestId = typeof params.requestId === 'string' ? params.requestId : undefined;
  const userId = typeof params.userId === 'string' ? params.userId : undefined;
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, userId]);

  // Typing indicator listener
  useEffect(() => {
    if (!requestId || !userId || !user?.uid) return;

    const typingDocRef = doc(db, 'typing_indicators', `${requestId}_${userId}`);
    
    const unsubscribe = onSnapshot(typingDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const lastTyping = data.timestamp?.toMillis();
        const now = Date.now();
        
        // Consider typing if updated within last 3 seconds
        const isTyping = data.typing && lastTyping && (now - lastTyping < 3000);
        
        if (isTyping && !otherUserTyping) {
          // Start performance trace
          typingTraceRef.current = startTrace(PerformanceTraces.TYPING_INDICATOR_LATENCY);
          lastTypingStartRef.current = now;
          
          // Track analytics
          trackTypingDetected({
            chat_id: requestId,
          });
        } else if (!isTyping && otherUserTyping && typingTraceRef.current) {
          // Stop performance trace
          typingTraceRef.current.stop();
          typingTraceRef.current = null;
          
          // Track response time
          const responseTime = Date.now() - lastTypingStartRef.current;
          if (responseTime > 0) {
            trackTypingDetected({
              chat_id: requestId,
              response_time: responseTime,
            });
          }
        }
        
        setOtherUserTyping(isTyping);
      } else {
        setOtherUserTyping(false);
        if (typingTraceRef.current) {
          typingTraceRef.current.stop();
          typingTraceRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (typingTraceRef.current) {
        typingTraceRef.current.stop();
      }
    };
  }, [requestId, userId, user?.uid, otherUserTyping]);

  const fetchChatData = async () => {
    try {
      // Fetch chat user info from Firebase
      const userDoc = await getDoc(doc(db, 'users', userId!));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setChatUser({
          id: userDoc.id,
          full_name: userData.full_name || userData.display_name || 'Unknown User',
          user_type: userData.user_type || userData.role || 'customer',
          rating: userData.rating || 0,
        });
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

      // Set up real-time listener for messages
      const chatId = `${requestId}_${user.uid < userId! ? user.uid : userId}_${user.uid < userId! ? userId : user.uid}`;
      const messagesQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('created_at', 'asc')
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        snapshot => {
          const fetchedMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sender: {
              full_name: doc.data().sender_name || 'Unknown',
              user_type: doc.data().sender_type || 'customer',
            },
          })) as Message[];

          setMessages(fetchedMessages);
          setLoading(false);
        },
        error => {
          console.error('Error fetching messages:', error);
          setLoading(false);
        }
      );

      return unsubscribe;
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
      // Create deterministic chat ID
      const chatId = `${requestId}_${user.uid < userId! ? user.uid : userId}_${user.uid < userId! ? userId : user.uid}`;

      // Add message to Firebase
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        content: sanitizedMessage,
        sender_id: user.uid,
        receiver_id: userId,
        request_id: requestId,
        sender_name: user.displayName || 'Unknown',
        sender_type: user.user_type || 'customer',
        created_at: serverTimestamp(),
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
      const typingDocRef = doc(db, 'typing_indicators', `${requestId}_${user.uid}`);
      await setDoc(typingDocRef, {
        userId: user.uid,
        typing: true,
        timestamp: serverTimestamp(),
      }, { merge: true });

      // Clear typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(async () => {
        await setDoc(typingDocRef, {
          typing: false,
          timestamp: serverTimestamp(),
        }, { merge: true });
      }, 3000);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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
    return `${role} • ⭐ ${rating.toFixed(1)}`;
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
    messages.forEach(message => {
      if (!messageAnimations.current[message.id]) {
        messageAnimations.current[message.id] = new Animated.Value(0);
        animateMessage(message.id);
      }
    });
  }, [messages]);

  const handleAttachmentPress = async () => {
    Alert.alert('Velg vedlegg', 'Hvilken type fil vil du legge ved?', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Kamera', onPress: openCamera },
      { text: 'Galleri', onPress: openImagePicker },
      { text: 'Dokument', onPress: openDocumentPicker },
    ]);
  };

  const openCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Tillatelse', 'Du må gi tillatelse til kameraet for å ta bilder');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: [ImagePicker.MediaType.Images],
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
      mediaTypes: [ImagePicker.MediaType.Images, ImagePicker.MediaType.Videos],
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
      // TODO: Upload file to server and send as message
      const fileName = file.name || 'attachment';
      const fileSize = file.size ? `(${Math.round(file.size / 1024)}KB)` : '';

      Alert.alert(
        'Fil valgt',
        `${fileName} ${fileSize}\n\nFilopplasting vil bli implementert senere.`
      );
    } catch (error) {
      console.error('Error handling file:', error);
      Alert.alert('Feil', 'Kunne ikke behandle filen');
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
    }, []);

    return (
      <View style={styles.typingIndicatorContainer}>
        <View style={styles.typingIndicator}>
          <Animated.View
            style={[
              styles.typingDot,
              { transform: [{ translateY: dot1 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.typingDot,
              { transform: [{ translateY: dot2 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.typingDot,
              { transform: [{ translateY: dot3 }] },
            ]}
          />
        </View>
        <Text style={styles.typingText}>
          {chatUser?.full_name || t('user')} {t('isTyping') || 'skriver'}...
        </Text>
      </View>
    );
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.iconColors.dark} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{getUserInitials(chatUser?.full_name || '')}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.userName}>{chatUser?.full_name || t('unknownUser')}</Text>
            <Text style={styles.userRole}>
              {chatUser ? getUserRoleText(chatUser.user_type, chatUser.rating) : ''}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.infoButton}>
          <Ionicons name="information-circle" size={24} color={theme.iconColors.gray.primary} />
        </TouchableOpacity>
      </View>

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
                          <Text style={[styles.messageTime, styles.sentMessageTime]}>
                            {formatTime(message.created_at)}
                          </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
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
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 12,
    marginRight: 8,
  },
  routeLocation: {
    fontSize: 13,
    color: '#616161',
    fontWeight: '500',
    flex: 1,
  },
  routeArrow: {
    paddingLeft: 4,
    paddingVertical: 2,
  },
  routeArrowText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  detailsButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F97316',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  detailsButtonText: {
    fontSize: 12,
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
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#616161',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#616161',
    marginTop: 12,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    marginHorizontal: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
    backgroundColor: 'white',
    paddingHorizontal: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  sentMessageText: {
    color: 'white',
  },
  receivedMessageText: {
    color: '#000000',
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  sentMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedMessageTime: {
    color: '#616161',
  },
  inputContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 18,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    color: '#212121',
    minHeight: 36,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
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

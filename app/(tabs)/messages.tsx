import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useDebounce } from '../../hooks/useDebounce';
import { useNotifications } from '../../hooks/useNotifications';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { triggerHapticFeedback } from '../../utils/haptics';
import { theme } from '../../theme/theme';
import { EmptyState } from '../../components/EmptyState';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
  gradients,
} from '../../lib/sharedStyles';

interface Conversation {
  id: string;
  request_id: string;
  other_user: {
    id: string;
    full_name: string;
    user_type: string;
    rating: number;
  };
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
  cargo_request: {
    title: string;
    cargo_type: string;
  };
}

function MessagesScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const fetchConversations = async () => {
    try {
      if (!user?.uid) return;

      // Get messages where user is sender
      const senderQuery = query(
        collection(db, 'messages'),
        where('sender_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );

      // Get messages where user is receiver
      const receiverQuery = query(
        collection(db, 'messages'),
        where('receiver_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );

      const [senderSnap, receiverSnap] = await Promise.all([
        getDocs(senderQuery),
        getDocs(receiverQuery),
      ]);

      // Combine all messages
      const userMessages = [
        ...senderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...receiverSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ];

      // Group messages by conversation and get latest message
      const conversationMap = new Map();

      for (const message of userMessages as any[]) {
        const otherUserId =
          message.sender_id === user.uid ? message.receiver_id : message.sender_id;
        const key = `${message.request_id}-${otherUserId}`;

        if (!conversationMap.has(key)) {
          // Fetch other user data
          let otherUser = null;
          try {
            const userRef = doc(db, 'users', otherUserId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              otherUser = { id: userSnap.id, ...userSnap.data() };
            }
          } catch (err) {
            console.error('Error fetching user:', err);
          }

          // Fetch cargo request data
          let cargoRequest = null;
          try {
            const requestRef = doc(db, 'cargo_requests', message.request_id);
            const requestSnap = await getDoc(requestRef);
            if (requestSnap.exists()) {
              cargoRequest = requestSnap.data();
            }
          } catch (err) {
            console.error('Error fetching request:', err);
          }

          conversationMap.set(key, {
            id: key,
            request_id: message.request_id,
            other_user: otherUser || {
              id: otherUserId,
              full_name: 'Unknown User',
              user_type: 'customer',
              rating: 0,
            },
            last_message: {
              content: message.content,
              created_at: message.created_at,
              sender_id: message.sender_id,
            },
            unread_count: 0, // Would need separate query for this
            cargo_request: cargoRequest || { title: 'Unknown Request', cargo_type: 'other' },
          });
        }
      }

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleConversationPress = (conversation: Conversation) => {
    router.push(`/chat/${conversation.request_id}/${conversation.other_user.id}` as any);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getUserInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredConversations = conversations.filter(
    conv =>
      conv.other_user.full_name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      conv.last_message.content.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>{t('messages')}</Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/(tabs)/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={theme.iconColors.gray.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchMessages')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          <EmptyState
            icon="chatbubble-outline"
            title={t('emptyState.messages.title') || 'Ingen meldinger'}
            description={
              t('emptyState.messages.description') ||
              'Når du aksepterer bud eller sender forespørsler, vil samtaler dukke opp her.'
            }
            tips={t('emptyState.messages.tips', { returnObjects: true }) as string[]}
          />
        ) : (
          <View style={styles.conversationsList}>
            {filteredConversations.map(conversation => (
              <TouchableOpacity
                key={conversation.id}
                style={styles.conversationCard}
                onPress={() => handleConversationPress(conversation)}
              >
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitials}>
                      {getUserInitials(conversation.other_user.full_name)}
                    </Text>
                  </View>
                </View>

                <View style={styles.conversationInfo}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.userName}>{conversation.other_user.full_name}</Text>
                    <Text style={styles.timestamp}>
                      {formatTime(conversation.last_message.created_at)}
                    </Text>
                  </View>

                  {/* Request Preview */}
                  {conversation.cargo_request && (
                    <View style={styles.requestPreview}>
                      <Ionicons
                        name="cube-outline"
                        size={12}
                        color={theme.iconColors.primary}
                        style={styles.requestIcon}
                      />
                      <Text style={styles.requestTitle} numberOfLines={1}>
                        {conversation.cargo_request.title}
                      </Text>
                    </View>
                  )}

                  <View style={styles.lastMessageContainer}>
                    <Text
                      style={[
                        styles.lastMessage,
                        conversation.unread_count > 0 && styles.unreadMessage,
                      ]}
                      numberOfLines={1}
                    >
                      {conversation.last_message.sender_id === user?.uid ? t('you') + ': ' : ''}
                      {conversation.last_message.content}
                    </Text>
                    {conversation.unread_count > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>{conversation.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom spacing for tab bar */}
        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>
    </View>
  );
}

export default MessagesScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  notificationButton: {
    position: 'relative',
    padding: spacing.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  conversationsList: {
    backgroundColor: colors.white,
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 0,
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.outline,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.black,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  requestPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  requestIcon: {
    marginRight: 4,
  },
  requestTitle: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  lastMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  lastMessage: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  unreadMessage: {
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  unreadCount: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
});

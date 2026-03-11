import { supabase } from './supabase';

export type DocumentData = Record<string, unknown>;
export type QueryConstraint = {
  type: 'eq' | 'orderBy' | 'limit';
  field: string;
  value?: unknown;
  direction?: 'asc' | 'desc';
};

type SupabaseQueryDescriptor = {
  tableName: string;
  constraints: QueryConstraint[];
};

const TABLE_ALIASES: Record<string, string> = {
  cargoRequests: 'cargo_requests',
  cargo_requests: 'cargo_requests',
  bids: 'bids',
  messages: 'messages',
  notifications: 'notifications',
  users: 'users',
};

const resolveTableName = (name: string): string => TABLE_ALIASES[name] || name;

/**
 * Helper function to build Firestore queries
 */
export const buildQuery = (
  collectionName: string,
  constraints: QueryConstraint[]
): SupabaseQueryDescriptor => {
  return {
    tableName: resolveTableName(collectionName),
    constraints,
  };
};

/**
 * Fetch documents from a collection with constraints
 */
export const fetchDocuments = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
) => {
  try {
    const q = buildQuery(collectionName, constraints);
    let dbQuery = (supabase as any).from(q.tableName).select('*');

    for (const constraint of q.constraints) {
      if (constraint.type === 'eq') {
        dbQuery = dbQuery.eq(constraint.field, constraint.value);
      }

      if (constraint.type === 'orderBy') {
        dbQuery = dbQuery.order(constraint.field, {
          ascending: (constraint.direction || 'asc') === 'asc',
        });
      }

      if (constraint.type === 'limit' && typeof constraint.value === 'number') {
        dbQuery = dbQuery.limit(constraint.value);
      }
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: String((row as Record<string, unknown>).id),
      ...(row as Record<string, unknown>),
    }));
  } catch (error) {
    console.error(`Error fetching documents from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Fetch a single document by id
 */
export const getDocument = async <T = DocumentData>(
  collectionName: string,
  documentId: string
): Promise<T | null> => {
  try {
    const tableName = resolveTableName(collectionName);
    const { data, error } = await (supabase as any)
      .from(tableName)
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return data as T;
  } catch (error) {
    console.error(`Error fetching document ${collectionName}/${documentId}:`, error);
    throw error;
  }
};

/**
 * Fetch cargo requests with filters
 */
export const fetchCargoRequests = async (status?: string, userId?: string) => {
  try {
    let dbQuery = (supabase as any)
      .from('cargo_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    if (userId) {
      dbQuery = dbQuery.eq('customer_id', userId);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: String((row as Record<string, unknown>).id),
      ...(row as Record<string, unknown>),
    }));
  } catch (error) {
    console.error('Error fetching cargo requests:', error);
    throw error;
  }
};

/**
 * Fetch bids for a cargo request
 */
export const fetchBidsForRequest = async (requestId: string) => {
  try {
    const { data, error } = await (supabase as any)
      .from('bids')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: String((row as Record<string, unknown>).id),
      ...(row as Record<string, unknown>),
    }));
  } catch (error) {
    console.error(`Error fetching bids for request ${requestId}:`, error);
    throw error;
  }
};

/**
 * Fetch messages for a chat
 */
export const fetchChatMessages = async (chatId: string, limitCount = 50) => {
  try {
    const { data, error } = await (supabase as any)
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(limitCount);

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: String((row as Record<string, unknown>).id),
      ...(row as Record<string, unknown>),
    }));
  } catch (error) {
    console.error(`Error fetching chat messages for ${chatId}:`, error);
    throw error;
  }
};

/**
 * Fetch notifications for a user
 */
export const fetchUserNotifications = async (userId: string, unreadOnly = false) => {
  try {
    let dbQuery = (supabase as any)
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      dbQuery = dbQuery.eq('read', false);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: String((row as Record<string, unknown>).id),
      ...(row as Record<string, unknown>),
    }));
  } catch (error) {
    console.error(`Error fetching notifications for user ${userId}:`, error);
    throw error;
  }
};

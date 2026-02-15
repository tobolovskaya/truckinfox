import { logEvent as firebaseLogEvent } from 'firebase/analytics';
import { analytics } from '../lib/firebase';

/**
 * Log analytics event with automatic error handling
 * @param eventName - Name of the event to log
 * @param params - Event parameters
 */
export const logEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    // Only log if analytics is initialized (web platform)
    if (analytics) {
      firebaseLogEvent(analytics, eventName, params);
      console.log(`📊 Analytics: ${eventName}`, params);
    } else {
      // For native platforms, just log to console for now
      console.log(`📊 Analytics (console only): ${eventName}`, params);
    }
  } catch (error) {
    console.error('Error logging analytics event:', error);
  }
};

/**
 * Analytics event types for type safety
 */
export const AnalyticsEvents = {
  // Cargo Request Events
  CARGO_REQUEST_CREATED: 'cargo_request_created',
  CARGO_REQUEST_VIEWED: 'cargo_request_viewed',
  CARGO_REQUEST_UPDATED: 'cargo_request_updated',
  CARGO_REQUEST_DELETED: 'cargo_request_deleted',

  // Bid Events
  BID_SUBMITTED: 'bid_submitted',
  BID_ACCEPTED: 'bid_accepted',
  BID_REJECTED: 'bid_rejected',
  BID_WITHDRAWN: 'bid_withdrawn',

  // Payment Events
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_CANCELLED: 'payment_cancelled',

  // Order Events
  ORDER_CREATED: 'order_created',
  ORDER_STATUS_CHANGED: 'order_status_changed',
  DELIVERY_CONFIRMED: 'delivery_confirmed',
  DELIVERY_PROOF_SUBMITTED: 'delivery_proof_submitted',

  // Chat Events
  CHAT_STARTED: 'chat_started',
  MESSAGE_SENT: 'message_sent',

  // User Events
  USER_REGISTERED: 'user_registered',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  PROFILE_UPDATED: 'profile_updated',

  // Review Events
  REVIEW_SUBMITTED: 'review_submitted',
  REVIEW_VIEWED: 'review_viewed',

  // Search/Filter Events
  SEARCH_PERFORMED: 'search_performed',
  FILTERS_APPLIED: 'filters_applied',

  // Navigation Events
  SCREEN_VIEW: 'screen_view',

  // Filter Events
  FILTER_APPLIED: 'filter_applied',

  // Typing Events
  TYPING_DETECTED: 'typing_detected',
} as const;

/**
 * Helper functions for common analytics events
 */

export const trackCargoRequestCreated = (params: {
  cargo_type: string;
  pricing_model: string;
  price?: number;
  from_city?: string;
  to_city?: string;
}) => {
  logEvent(AnalyticsEvents.CARGO_REQUEST_CREATED, params);
};

export const trackBidSubmitted = (params: {
  request_id: string;
  amount: number;
  carrier_id?: string;
}) => {
  logEvent(AnalyticsEvents.BID_SUBMITTED, params);
};

export const trackBidAccepted = (params: {
  request_id: string;
  bid_id: string;
  bid_amount: number;
  carrier_id?: string;
}) => {
  logEvent(AnalyticsEvents.BID_ACCEPTED, params);
};

export const trackFilterApplied = (params: {
  sort_by: string;
  cargo_types_count: number;
  price_range: string;
}) => {
  logEvent(AnalyticsEvents.FILTER_APPLIED, params);
};

export const trackTypingDetected = (params: {
  chat_id: string;
  response_time?: number;
}) => {
  logEvent(AnalyticsEvents.TYPING_DETECTED, params);
};

export const trackPaymentInitiated = (params: {
  order_id: string;
  amount: number;
  method: string;
  payment_provider?: string;
}) => {
  logEvent(AnalyticsEvents.PAYMENT_INITIATED, params);
};

export const trackPaymentCompleted = (params: {
  order_id: string;
  amount: number;
  method: string;
  payment_provider?: string;
  transaction_id?: string;
}) => {
  logEvent(AnalyticsEvents.PAYMENT_COMPLETED, params);
};

export const trackDeliveryProofSubmitted = (params: {
  order_id: string;
  photo_count: number;
  has_signature: boolean;
}) => {
  logEvent(AnalyticsEvents.DELIVERY_PROOF_SUBMITTED, params);
};

export const trackOrderStatusChanged = (params: {
  order_id: string;
  old_status: string;
  new_status: string;
}) => {
  logEvent(AnalyticsEvents.ORDER_STATUS_CHANGED, params);
};

export const trackScreenView = (screenName: string, params?: Record<string, any>) => {
  logEvent(AnalyticsEvents.SCREEN_VIEW, {
    screen_name: screenName,
    ...params,
  });
};

export const trackSearch = (params: {
  search_term?: string;
  filters?: Record<string, any>;
  results_count?: number;
}) => {
  logEvent(AnalyticsEvents.SEARCH_PERFORMED, params);
};

export const trackChatStarted = (params: {
  request_id: string;
  other_user_id: string;
  chat_id: string;
}) => {
  logEvent(AnalyticsEvents.CHAT_STARTED, params);
};

export const trackReviewSubmitted = (params: {
  order_id: string;
  rating: number;
  has_comment: boolean;
}) => {
  logEvent(AnalyticsEvents.REVIEW_SUBMITTED, params);
};

export const trackUserRegistered = (params: {
  account_type: 'private' | 'business';
  registration_method?: string;
}) => {
  logEvent(AnalyticsEvents.USER_REGISTERED, params);
};

export const trackUserLogin = (params: { login_method?: string }) => {
  logEvent(AnalyticsEvents.USER_LOGGED_IN, params);
};

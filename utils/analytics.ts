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

export const trackTypingDetected = (params: { chat_id: string; response_time?: number }) => {
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

/**
 * Helper functions for categorizing analytics data
 */

/**
 * Categorize weight into ranges for analytics
 */
export const getWeightCategory = (weight: number): string => {
  if (weight < 100) return 'under_100kg';
  if (weight < 500) return '100_500kg';
  if (weight < 1000) return '500_1000kg';
  if (weight < 5000) return '1_5_tons';
  if (weight < 10000) return '5_10_tons';
  return 'over_10_tons';
};

/**
 * Categorize price into ranges for analytics
 */
export const getPriceRange = (price: number): string => {
  if (price < 500) return 'under_500';
  if (price < 1000) return '500_1000';
  if (price < 2500) return '1000_2500';
  if (price < 5000) return '2500_5000';
  if (price < 10000) return '5000_10000';
  return 'over_10000';
};

/**
 * Categorize distance into ranges for analytics
 */
export const getDistanceRange = (distanceKm: number): string => {
  if (distanceKm < 50) return 'under_50km';
  if (distanceKm < 100) return '50_100km';
  if (distanceKm < 250) return '100_250km';
  if (distanceKm < 500) return '250_500km';
  if (distanceKm < 1000) return '500_1000km';
  return 'over_1000km';
};

/**
 * Extract city name from full address string
 */
export const extractCity = (address: string): string => {
  if (!address) return 'unknown';
  
  // Try to extract city from address (format: "Street, City, Country" or "City, Country")
  const parts = address.split(',').map(part => part.trim());
  
  // If multiple parts, second-to-last is usually the city
  if (parts.length >= 2) {
    return parts[parts.length - 2].toLowerCase();
  }
  
  // If only one part, use it as city
  return parts[0].toLowerCase();
};

/**
 * Comprehensive cargo creation tracking with categorized data
 */
export const trackCargoCreated = async (params: {
  cargo_type: string;
  weight?: number;
  price?: number;
  pricing_model: string;
  from_address: string;
  to_address: string;
  distance_km?: number;
}) => {
  const analyticsParams: Record<string, any> = {
    cargo_type: params.cargo_type,
    pricing_model: params.pricing_model,
    from_city: extractCity(params.from_address),
    to_city: extractCity(params.to_address),
  };

  // Add weight category if weight is provided
  if (params.weight !== undefined && params.weight > 0) {
    analyticsParams.weight_category = getWeightCategory(params.weight);
    analyticsParams.weight = params.weight;
  }

  // Add price range if price is provided
  if (params.price !== undefined && params.price > 0) {
    analyticsParams.price_range = getPriceRange(params.price);
    analyticsParams.price = params.price;
  }

  // Add distance range if distance is provided
  if (params.distance_km !== undefined && params.distance_km > 0) {
    analyticsParams.distance_range = getDistanceRange(params.distance_km);
    analyticsParams.distance_km = params.distance_km;
  }

  logEvent('cargo_created', analyticsParams);
};

/**
 * Track when user opens a chat conversation
 */
export const trackChatOpened = async (params: {
  request_id: string;
  other_user_type: 'customer' | 'carrier';
  chat_id: string;
}) => {
  logEvent('chat_opened', params);
};

/**
 * Track when user sends a message
 */
export const trackMessageSent = async (params: {
  chat_id: string;
  message_length: number;
  has_attachment: boolean;
  request_id?: string;
}) => {
  logEvent('message_sent', params);
};

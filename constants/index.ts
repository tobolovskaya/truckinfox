/**
 * App-wide constants
 */

export const APP_NAME = 'TruckinFox';
export const APP_VERSION = '1.0.0';

// API URLs
export const BRREG_API_URL =
  process.env.BRREG_API_URL || 'https://data.brreg.no/enhetsregisteret/api';

// Firebase collections
export const COLLECTIONS = {
  USERS: 'users',
  CARGO_REQUESTS: 'cargoRequests',
  BIDS: 'bids',
  ORDERS: 'orders',
  MESSAGES: 'messages',
  CHATS: 'chats',
  REVIEWS: 'reviews',
  NOTIFICATIONS: 'notifications',
};

// Cargo request statuses
export const CARGO_STATUS = {
  DRAFT: 'draft',
  OPEN: 'open',
  BIDDING: 'bidding',
  ASSIGNED: 'assigned',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Bid statuses
export const BID_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

// Order statuses
export const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  REFUNDED: 'refunded',
};

// User roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  CARRIER: 'carrier',
  ADMIN: 'admin',
};

// Map configuration
export const MAP_CONFIG = {
  DEFAULT_LATITUDE: 59.9139, // Oslo
  DEFAULT_LONGITUDE: 10.7522,
  DEFAULT_DELTA: 0.0922,
};

// Notification types
export const NOTIFICATION_TYPES = {
  NEW_BID: 'new_bid',
  BID_ACCEPTED: 'bid_accepted',
  BID_REJECTED: 'bid_rejected',
  MESSAGE: 'message',
  ORDER_UPDATE: 'order_update',
  DELIVERY_COMPLETED: 'delivery_completed',
  REVIEW_RECEIVED: 'review_received',
};

// File upload limits
export const FILE_LIMITS = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGES_PER_REQUEST: 5,
};

// Validation
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MIN_BID_AMOUNT: 100,
  MAX_BID_AMOUNT: 1000000,
  MIN_CARGO_WEIGHT: 1,
  MAX_CARGO_WEIGHT: 50000,
};

export default {
  APP_NAME,
  APP_VERSION,
  BRREG_API_URL,
  COLLECTIONS,
  CARGO_STATUS,
  BID_STATUS,
  ORDER_STATUS,
  USER_ROLES,
  MAP_CONFIG,
  NOTIFICATION_TYPES,
  FILE_LIMITS,
  VALIDATION,
};

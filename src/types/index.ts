export type UserRole = 'customer' | 'carrier';

export type PricingModel = 'fixed' | 'negotiable';

export type CargoCategory =
  | 'general'
  | 'furniture'
  | 'vehicles'
  | 'machinery'
  | 'construction'
  | 'food'
  | 'fragile'
  | 'hazardous'
  | 'other';

export type OrderStatus =
  | 'pending_bids'
  | 'bid_accepted'
  | 'paid'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone: string;
  city: string;
  avatarUrl?: string;
  createdAt: string;
  rating?: number;
  reviewCount?: number;
}

export interface CustomerProfile extends User {
  role: 'customer';
  orderHistory: string[];
}

export interface CarrierProfile extends User {
  role: 'carrier';
  companyName: string;
  organizationNumber: string;
  description: string;
  specializations: string[];
  verified: boolean;
  completedJobs: number;
  logoUrl?: string;
}

export interface CargoRequest {
  id: string;
  customerId: string;
  category: CargoCategory;
  title: string;
  description: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupDate: string;
  deliveryDate: string;
  weight: number;
  dimensions: string;
  pricingModel: PricingModel;
  suggestedPrice?: number;
  photos?: string[];
  status: OrderStatus;
  createdAt: string;
  selectedBidId?: string;
}

export interface Bid {
  id: string;
  cargoRequestId: string;
  carrierId: string;
  price: number;
  estimatedDeliveryDate: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Order {
  id: string;
  cargoRequestId: string;
  customerId: string;
  carrierId: string;
  bidId: string;
  status: OrderStatus;
  paymentStatus: 'pending' | 'escrowed' | 'released' | 'refunded';
  totalAmount: number;
  carrierAmount: number;
  platformFee: number;
  createdAt: string;
  paidAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  trackingData?: TrackingData;
}

export interface TrackingData {
  currentLocation: {
    lat: number;
    lng: number;
  };
  speed: number;
  heading: number;
  lastUpdate: string;
  eta?: string;
  distance?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  cargoRequestId?: string;
}

export interface Rating {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  rating: number;
  review?: string;
  createdAt: string;
}

export interface Language {
  code: 'no' | 'en';
  name: string;
}

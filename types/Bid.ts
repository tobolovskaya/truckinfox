export interface Bid {
  id: string;
  orderId: string;
  carrierId: string;
  carrierName: string;
  carrierRating: number;
  amount: number;
  message: string;
  estimatedPickupDate: Date;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

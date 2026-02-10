export interface Order {
  id: string;
  customerId: string;
  carrierId?: string;
  pickupLocation: Location;
  deliveryLocation: Location;
  pickupDate: Date;
  deliveryDate: Date;
  cargoDetails: CargoDetails;
  pricingModel: 'fixed' | 'negotiable' | 'auction';
  suggestedPrice?: number;
  status: OrderStatus;
  bids: Bid[];
  payment?: PaymentInfo;
  tracking?: TrackingInfo;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus =
  | 'PENDING' // Waiting for bids
  | 'BIDDING' // Receiving bids
  | 'CARRIER_SELECTED' // Customer selected carrier
  | 'PAID_AND_IN_PROGRESS' // Payment received, in transit
  | 'IN_TRANSIT' // GPS tracking active
  | 'DELIVERED' // Customer confirmed delivery
  | 'COMPLETED' // Payment released, ratings done
  | 'CANCELLED'
  | 'DISPUTED';

export interface CargoDetails {
  description: string;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  fragile: boolean;
  specialRequirements?: string;
  photos?: string[];
}

export interface Location {
  address: string;
  city: string;
  postalCode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

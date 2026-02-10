export type OrderStatus = 'draft' | 'open' | 'assigned' | 'in_transit' | 'delivered';

export type Order = {
  id: string;
  title: string;
  status: OrderStatus;
  pickupLocation: string;
  dropoffLocation: string;
  price: number;
};

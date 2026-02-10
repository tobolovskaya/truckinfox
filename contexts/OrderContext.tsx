import { createContext, PropsWithChildren, useMemo, useState } from 'react';
import type { Order } from '../types/Order';

type OrderContextValue = {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
};

export const OrderContext = createContext<OrderContextValue>({
  orders: [],
  setOrders: () => undefined,
});

export function OrderProvider({ children }: PropsWithChildren) {
  const [orders, setOrders] = useState<Order[]>([]);

  const value = useMemo(() => ({ orders, setOrders }), [orders]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}
